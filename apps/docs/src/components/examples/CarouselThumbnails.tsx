'use client';
import { useCarousel } from 'ui/components/Carousel';

interface CarouselThumbnailsProps {
  items: string[];
}

export function CarouselThumbnails({ items }: CarouselThumbnailsProps) {
  const { currentIndex, scrollToIndex } = useCarousel();

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-02)', marginTop: 'var(--space-03)' }}>
      {items.map((label, index) => {
        const isActive = index === currentIndex;

        return (
          <button
            aria-current={isActive ? 'true' : undefined}
            key={label}
            onClick={() => scrollToIndex(index)}
            style={{
              background: isActive ? 'var(--background-highlight)' : 'var(--background-02)',
              border: isActive ? '2px solid var(--foreground-01)' : '2px solid transparent',
              borderRadius: 'var(--radius-02)',
              cursor: 'pointer',
              fontSize: 'var(--font-size-02)',
              padding: 'var(--space-02) var(--space-03)'
            }}
            type="button"
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
