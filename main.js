const fetchWithTimeout = (url, options = {}) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer))
}

const parseResponse = async (resp, label) => {
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`${label} HTTP ${resp.status}: ${text.substring(0, 200)}`)
  }
  return resp.json()
}

const glados = async () => {
  const notice = []
  if (!process.env.GLADOS) return
  for (const cookie of String(process.env.GLADOS).split('\n')) {
    const trimmed = cookie.trim()
    if (!trimmed) continue
    try {
      const common = {
        'cookie': trimmed,
        'referer': 'https://glados.cloud/console/checkin',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      }
      const action = await fetchWithTimeout('https://glados.cloud/api/user/checkin', {
        method: 'POST',
        headers: { ...common, 'content-type': 'application/json' },
        body: '{"token":"glados.cloud"}',
      }).then((r) => parseResponse(r, 'Checkin'))
      if (action?.code) throw new Error(action?.message)
      const status = await fetchWithTimeout('https://glados.cloud/api/user/status', {
        method: 'GET',
        headers: { ...common },
      }).then((r) => parseResponse(r, 'Status'))
      if (status?.code) throw new Error(status?.message)
      notice.push(
        'Checkin OK',
        `${action?.message}`,
        `Left Days ${Number(status?.data?.leftDays)}`
      )
    } catch (error) {
      notice.push(
        'Checkin Error',
        `${error}`,
        `<${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}>`
      )
    }
  }
  return notice
}

const sendPushPlus = (token, notice) => {
  return fetchWithTimeout('https://www.pushplus.plus/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      token,
      title: notice[0],
      content: notice.join('<br>'),
      template: 'markdown',
    }),
  })
}

const notify = async (notice) => {
  if (!process.env.NOTIFY || !notice) return
  for (const option of String(process.env.NOTIFY).split('\n')) {
    const trimmed = option.trim()
    if (!trimmed) continue
    if (trimmed.startsWith('console:')) {
      for (const line of notice) {
        console.log(line)
      }
    } else if (trimmed.startsWith('wxpusher:')) {
      const parts = trimmed.split(':')
      await fetchWithTimeout('https://wxpusher.zjiecode.com/api/send/message', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          appToken: parts[1],
          summary: notice[0],
          content: notice.join('<br>'),
          contentType: 3,
          uids: parts.slice(2),
        }),
      })
    } else if (trimmed.startsWith('pushplus:')) {
      await sendPushPlus(trimmed.split(':')[1], notice)
    } else if (trimmed.startsWith('qyweixin:')) {
      const token = trimmed.split(':')[1]
      await fetchWithTimeout('https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=' + token, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          msgtype: 'markdown',
          markdown: { content: notice.join('<br>') },
        }),
      })
    } else {
      // fallback: treat as pushplus token
      await sendPushPlus(trimmed, notice)
    }
  }
}

const main = async () => {
  const result = await glados()
  await notify(result)
  if (result?.some((line) => line === 'Checkin Error')) {
    process.exitCode = 1
  }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
