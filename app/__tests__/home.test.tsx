import { render, screen } from '@testing-library/react';
import HomePage from '@/app/page';

jest.mock('next-auth/react', () => ({
  __esModule: true,
  // Minimal mocks to satisfy HomePage usage
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

describe('HomePage', () => {
  it('renders the heading', () => {
    render(<HomePage />);
    expect(
      screen.getByRole('heading', {
        name: /Next\.js \+ Postgres \+ Google Sign-In/i,
      })
    ).toBeInTheDocument();
  });
});

