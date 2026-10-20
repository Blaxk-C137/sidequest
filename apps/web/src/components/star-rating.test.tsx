import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { StarRating } from './ui/star-rating';

function Harness() {
  const [value, setValue] = useState<number | null>(null);
  return (
    <>
      <StarRating value={value} onChange={setValue} />
      <p data-testid="value">{value ?? 'none'}</p>
    </>
  );
}

describe('StarRating', () => {
  it('exposes five radios with descriptive labels', () => {
    render(<Harness />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(5);
    expect(screen.getByRole('radio', { name: /^5 stars — loved it$/i })).toBeInTheDocument();
  });

  it('selects a rating and toggles it off when tapped again', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('radio', { name: /^4 stars/i }));
    expect(screen.getByTestId('value')).toHaveTextContent('4');
    expect(screen.getByRole('radio', { name: /^4 stars/i })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('radio', { name: /^4 stars/i }));
    expect(screen.getByTestId('value')).toHaveTextContent('none');
  });
});
