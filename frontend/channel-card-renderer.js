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
function getChannelThemeId(channel) {
    const theme =
        channel.channelCardTheme ||
        channel.channelCardThemeId ||
        channel.channelTheme ||
        channel.channelThemeId ||
        channel.channelThemeKey ||
        channel.cardTheme ||
        channel.cardThemeId ||
        channel.cardThemeKey ||
        channel.selectedTheme ||
        channel.selectedThemeId ||
        channel.themeId ||
        channel.themeKey ||
        channel.theme;
    const themeId = typeof theme === "string"
        ? theme
        : theme?.id || theme?.themeId || theme?.key;

    return typeof themeId === "string" && /^[a-z0-9_-]+$/i.test(themeId)
        ? themeId
        : "";
}

export function getChannelCardMarkup(channel, options = {}) {
    const themeId = options.applyChannelTheme === true ? getChannelThemeId(channel) : "";
    const themeAttribute = themeId ? ` data-cc-theme="${themeId}"` : "";

    return `
    <div class="channel-card"${themeAttribute}>
        <img src="${channel.channelLogo}" class="channel-img" alt="${channel.channelName || 'Channel'} Logo" loading="lazy">
        <h3>${channel.channelName || ''}</h3>
        <p>👥 ${channel.subscribers || '0'}</p>
        <p>🎬 ${channel.totalVideos || '0'} Videos</p>
        <a href="channel.html?id=${channel.channelId}">View Channel</a>
    </div>
    `;
}
