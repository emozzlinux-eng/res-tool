import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from '../components/ui/Card';

describe('test setup smoke', () => {
  it('provides a resettable in-memory localStorage', () => {
    localStorage.setItem('k', 'v');
    expect(localStorage.getItem('k')).toBe('v');
    localStorage.clear();
    expect(localStorage.getItem('k')).toBeNull();
  });

  it('renders a component', () => {
    render(<Card>hello</Card>);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });
});
