import { render, screen } from '@testing-library/react';
import MetricGrid from '../components/MetricGrid';

describe('MetricGrid', () => {
  it('показывает tooltip, coverage и значение по умолчанию', () => {
    render(
      <MetricGrid
        items={[
          {
            id: 'kills',
            label: 'Kills',
            displayValue: '5',
            tooltip: 'Подсказка',
            coverage: { trackedMatches: 1, totalMatches: 2, label: 'Kills tracked: 1/2' }
          },
          {
            id: 'kd',
            label: 'K/D'
          }
        ]}
      />
    );

    expect(screen.getByText('Kills')).toBeInTheDocument();
    expect(screen.getByLabelText('Подсказка')).toBeInTheDocument();
    expect(screen.getByTitle('Kills tracked: 1/2')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
