'use client';
import { Carousel, CarouselIndicators, CarouselItem, CarouselNext, CarouselPrevious, CarouselViewport } from 'ui/components/Carousel';

export function CarouselBasic() {
  return (
    <Carousel aria-label="Featured items demo" roleDescription="carousel">
      <CarouselViewport>
        <CarouselItem roleDescription="slide">
          <div className="demo-card" style={{ minHeight: '160px' }}>
            Slide one
          </div>
        </CarouselItem>
        <CarouselItem roleDescription="slide">
          <div className="demo-card" style={{ minHeight: '160px' }}>
            Slide two
          </div>
        </CarouselItem>
        <CarouselItem roleDescription="slide">
          <div className="demo-card" style={{ minHeight: '160px' }}>
            Slide three
          </div>
        </CarouselItem>
      </CarouselViewport>
      <CarouselPrevious aria-label="Previous slide" />
      <CarouselNext aria-label="Next slide" />
      <CarouselIndicators getIndicatorLabel={(i, total) => `Go to slide ${i + 1} of ${total}`} />
    </Carousel>
  );
}
