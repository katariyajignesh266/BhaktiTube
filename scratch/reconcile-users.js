const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// Path to the service account key in the scratch directory
const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");

if (!fs.existsSync(serviceAccountPath)) {
  console.error("Error: serviceAccountKey.json not found in scratch/ directory!");
  console.log("\nTo run this script, follow these steps:");
  console.log("1. Go to Firebase Console -> Project Settings -> Service accounts.");
  console.log("2. Click 'Generate new private key' and download the JSON file.");
  console.log("3. Rename the downloaded JSON file to 'serviceAccountKey.json'.");
  console.log("4. Place it in the 'scratch' directory of this project.");
  console.log("5. Ensure you have the firebase-admin dependency installed (run: npm install firebase-admin).");
  console.log("6. Run the script: node scratch/reconcile-users.js\n");
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

async function reconcileUsers() {
  console.log("Starting user reconciliation and watch time math audit...");
  
  let totalAuthUsers = 0;
  let createdCount = 0;
  let nextPageToken;

  do {
    const listUsersResult = await auth.listUsers(1000, nextPageToken);
    totalAuthUsers += listUsersResult.users.length;

    for (const userRecord of listUsersResult.users) {
      const uid = userRecord.uid;
      const email = userRecord.email || "";
      const displayName = userRecord.displayName || "BhaktiTube User";
      const photoURL = userRecord.photoURL || "";
      const joinedAtMs = new Date(userRecord.metadata.creationTime).getTime();

      // Query actual watchProgress documents to recalculate cumulative stats
      const progressSnap = await db.collection("users").doc(uid).collection("watchProgress").get();
      let calculatedWatchTime = 0;
      let completedVideosCount = 0;

      progressSnap.forEach((doc) => {
        const data = doc.data();
        const seconds = Math.max(
          Number(data.totalWatchTime || 0),
          Math.min(Number(data.currentPosition || 0), Number(data.duration || 0))
        );
        calculatedWatchTime += seconds;
        if (data.completed || Number(data.completionPercentage || 0) >= 95) {
          completedVideosCount++;
        }
      });

      const userDocRef = db.collection("users").doc(uid);
      const userDoc = await userDocRef.get();

      if (!userDoc.exists) {
        console.log(`Reconciling missing profile for: ${email || uid} (Watch Time: ${calculatedWatchTime}s)`);
        await userDocRef.set({
          uid,
          email,
          displayName,
          photoURL,
          joinedAtMs,
          lastActiveMs: joinedAtMs, // fallback to signup time
          lastDevice: {
            os: "Unknown",
            browser: "Unknown",
            mobile: false,
            platform: "Unknown",
            userAgent: "Reconciliation Script"
          },
          totalWatchTime: calculatedWatchTime,
          completedVideos: completedVideosCount,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        createdCount++;
      } else {
        console.log(`Syncing watch stats for existing profile: ${email || uid} (Watch Time: ${calculatedWatchTime}s)`);
        
        const updatePayload = {
          totalWatchTime: calculatedWatchTime,
          completedVideos: completedVideosCount,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // Also repair missing signup/activity timestamps if they are absent
        const data = userDoc.data();
        if (!data.lastActiveMs) {
          updatePayload.lastActiveMs = data.joinedAtMs || joinedAtMs;
        }

        await userDocRef.update(updatePayload);
        createdCount++;
      }
    }

    nextPageToken = listUsersResult.pageToken;
  } while (nextPageToken);

  console.log(`\nReconciliation complete!`);
  console.log(`Total Auth Users scanned: ${totalAuthUsers}`);
  console.log(`Profiles created or repaired: ${createdCount}`);
}

reconcileUsers().catch((error) => {
  console.error("Reconciliation failed:", error);
});
