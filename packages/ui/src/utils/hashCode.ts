export function hashCode(name: string) {
  let hash = 0;

  for (let index = 0; index < name.length; index++) {
    const character = name.charCodeAt(index);
    hash = (hash << 5) - hash + character;
    hash = hash & hash;
  }

  return Math.abs(hash);
}
