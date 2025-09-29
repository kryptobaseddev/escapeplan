const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit'
});

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit'
});

export function formatTime(value: string) {
  return timeFormatter.format(new Date(value));
}

export function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

export function formatTimer(remainingSeconds: number) {
  const minutes = Math.floor(Math.max(remainingSeconds, 0) / 60);
  const seconds = Math.max(remainingSeconds, 0) % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
