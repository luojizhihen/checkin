import https from 'https';

const getEnvVariable = (name) => {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} 未在环境变量中设置`);
    }
    return value;
};

const httpsRequest = (url, options, timeout = 8000) => {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`HTTP 错误! 状态码: ${res.statusCode}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('请求超时'));
        });

        req.setTimeout(timeout);
        req.end();
    });
};

const gladosCheckin = async (cookie) => {
    const headers = {
        'cookie': cookie,
        'referer': 'https://glados.rocks/console/checkin',
        'user-agent': 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0)',
    };

    try {
        const checkinResponse = await httpsRequest('https://glados.rocks/api/user/checkin', {
            method: 'POST',
            headers: { ...headers, 'content-type': 'application/json' },
            timeout: 15000, // 超时时间设置为15秒
        });

        const statusResponse = await httpsRequest('https://glados.rocks/api/user/status', {
            method: 'GET',
            headers,
            timeout: 15000, // 超时时间设置为15秒  
        });

        return [
            'Checkin OK',
            `${checkinResponse.message}`,
            `剩余天数 ${Number(statusResponse.data.leftDays)}`,
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
        await httpsRequest('https://www.pushplus.plus/send', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            timeout: 15000, // 超时时间设置为15秒
        }, JSON.stringify({
            token,
            title: contents[0],
            content: contents.join(''),
            template: 'markdown',
        }));
    } catch (error) {
        console.error('通知发送失败:', error);
    }
};

const main = async () => {
    try {
        const cookie = getEnvVariable('GLADOS');
        const notifyToken = getEnvVariable('NOTIFY');
        const checkinResult = await gladosCheckin(cookie);
        await sendNotification(notifyToken, checkinResult);
    } catch (error) {
        console.error('主函数执行出错:', error);
    }
};

main();
