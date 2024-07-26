const fetch = require('node-fetch');

const getEnvVariable = (name) => {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} not set in environment variables`);
    }
    return value;
};

const fetchWithTimeout = async (url, options = {}) => {
    const { timeout = 8000 } = options; // 默认超时为8秒
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options, signal: controller.signal,
        });

        clearTimeout(id);

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new Error('Fetch Timeout');
        }
        throw error;
    }
};

const gladosCheckin = async (cookie) => {
    const headers = {
        'cookie': cookie,
        'referer': 'https://glados.rocks/console/checkin',
        'user-agent': 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0)',
    };

    try {
        const checkinResponse = await fetchWithTimeout('https://glados.rocks/api/user/checkin', {
            method: 'POST',
            headers: { ...headers, 'content-type': 'application/json' },
            body: JSON.stringify({ token: 'glados.one' }),
            timeout: 15000, // 等待时间设置为15秒
        });

        const statusResponse = await fetchWithTimeout('https://glados.rocks/api/user/status', {
            method: 'GET',
            headers,
            timeout: 15000, // 等待时间设置为15秒
        });

        return [
            'Checkin OK',
            `${checkinResponse.message}`,
            `Left Days ${Number(statusResponse.data.leftDays)}`,
        ];
    } catch (error) {
        return [
            'Checkin Error',
            error.message,
            `<${getEnvVariable('GITHUB_SERVER_URL')}/${getEnvVariable('GITHUB_REPOSITORY')}>`,
        ];
    }
};

const sendNotification = async (token, contents) => {
    if (!token || !contents) return;
    try {
        await fetchWithTimeout('https://www.pushplus.plus/send', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                token,
                title: contents[0],
                content: contents.join('\n'), // 修正这里的换行符
                template: 'markdown',
            }),
            timeout: 15000, // 等待时间设置为15秒
        });
    } catch (error) {
        console.error('Notification Error:', error);
    }
};

const main = async () => {
    try {
        const cookie = getEnvVariable('GLADOS');
        const notifyToken = getEnvVariable('NOTIFY');
        const checkinResult = await gladosCheckin(cookie);
        await sendNotification(notifyToken, checkinResult);
    } catch (error) {
        console.error('Error in main function:', error);
    }
};

main();
