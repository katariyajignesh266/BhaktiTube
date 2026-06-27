/**
 * Shared Channel Card Component Renderer
 * Returns the exact HTML markup used for rendering a channel card across the site.
 * 
 * @param {Object} channel - The channel data object
 * @param {string} channel.channelLogo - URL of the channel logo
 * @param {string} channel.channelName - Name of the channel
 * @param {string|number} channel.subscribers - Subscriber count text
 * @param {string|number} channel.totalVideos - Total videos count
 * @param {string} channel.channelId - ID of the channel
 */
export function getChannelCardMarkup(channel) {
    return `
    <div class="channel-card">
        <img src="${channel.channelLogo}" class="channel-img" alt="${channel.channelName || 'Channel'} Logo" loading="lazy">
        <h3>${channel.channelName || ''}</h3>
        <p>👥 ${channel.subscribers || '0'}</p>
        <p>🎬 ${channel.totalVideos || '0'} Videos</p>
        <a href="channel.html?id=${channel.channelId}">View Channel</a>
    </div>
    `;
}
