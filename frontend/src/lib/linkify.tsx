import React from 'react'

const URL_REGEX = /https?:\/\/[^\s<>"'、。「」『』]+/g
const TRAILING_PUNCTUATION = /[.,;:!?)\]}]+$/

export function linkify(text: string | null | undefined): React.ReactNode[] {
  if (!text) return []
  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  let key = 0
  const re = new RegExp(URL_REGEX.source, 'g')
  let match: RegExpExecArray | null

  while ((match = re.exec(text)) !== null) {
    let url = match[0]
    const start = match.index
    const trailing = url.match(TRAILING_PUNCTUATION)
    if (trailing) {
      url = url.slice(0, -trailing[0].length)
      re.lastIndex = start + url.length
    }
    if (!/^https?:\/\//.test(url)) continue
    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start))
    }
    nodes.push(
      <a
        key={`linkify-${key++}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 underline break-all"
      >
        {url}
      </a>
    )
    lastIndex = start + url.length
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }
  return nodes
}
