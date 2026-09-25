export function moveCourse<T extends { id: string }>(items: readonly T[], activeId: string, overId: string): T[] {
  const from = items.findIndex((item) => item.id === activeId);
  const to = items.findIndex((item) => item.id === overId);
  if (from < 0 || to < 0 || from === to) return [...items];
  const next = [...items];
  const [active] = next.splice(from, 1);
  next.splice(to, 0, active);
  return next;
}
