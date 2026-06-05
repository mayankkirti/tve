function parseTime(timeStr) {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}
function parseTracklist(raw) {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  const tracks = [];
  for (const line of lines) {
    const match = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)[ \t]*(?:\||-|—)?[ \t]+(.+)$/);
    if (match) {
      tracks.push({ timeSeconds: parseTime(match[1]) });
    }
  }
  return tracks.sort((a, b) => a.timeSeconds - b.timeSeconds);
}
console.log(parseTracklist("00:00 Intro\n01:30 Track 1\n05:00 Track 2"));
