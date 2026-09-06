import { hashCode } from '../../../utils/hashCode';

function getRandomColor(number: number, colors: string[], range: number): string {
  return colors[number % range];
}

function getDigit(number: number, ntn: number): number {
  return Math.floor((number / Math.pow(10, ntn)) % 10);
}

function getUnit(number: number, range: number, index?: number): number {
  const value = number % range;

  if (index && getDigit(number, index) % 2 === 0) {
    return -value;
  } else {
    return value;
  }
}

export function generateColors(name: string, colors: string[], elements: number, size: number) {
  const code = hashCode(name);
  const range = colors ? colors.length : 1;

  return Array.from({ length: elements }, (_, index) => ({
    color: getRandomColor(code + index, colors, range),
    rotate: getUnit(code * (index + 1), 360, 1),
    scale: 1.2 + getUnit(code * (index + 1), size / 20) / 10,
    translateX: getUnit(code * (index + 1), size / 10, 1),
    translateY: getUnit(code * (index + 1), size / 10, 2)
  }));
}
