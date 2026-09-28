import { useId } from 'react';

import { ChartAxes, ChartFrame } from 'ui/components/ChartFrame';

/** The chart-frame page's example: a frame, its axes and nothing else, named with `useId` like a real chart. */
export function ChartFrameExample() {
  const titleId = useId();

  return (
    <ChartFrame
      dataLabel="Show data"
      empty={false}
      emptyLabel="Nothing to show."
      table={{
        columns: ['Calls'],
        labelsHeader: 'Day',
        rows: [
          { cells: ['40'], label: '27 Sept' },
          { cells: ['80'], label: '28 Sept' }
        ]
      }}
      title="Calls"
      titleId={titleId}
    >
      <svg aria-labelledby={titleId} height={120} role="img" width="100%">
        <ChartAxes
          labels={[
            { anchor: 'start', minor: false, text: '27 Sept', x: 0 },
            { anchor: 'end', minor: false, text: '28 Sept', x: 100 }
          ]}
          labelY={112}
          ticks={[
            { text: '0', y: 96 },
            { text: '50', y: 56 },
            { text: '100', y: 16 }
          ]}
        />
      </svg>
    </ChartFrame>
  );
}
