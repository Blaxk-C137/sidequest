import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QUESTIONS } from '@blaxaura/shared';
import { QuizFlow } from './QuizFlow';
import { FlowProvider } from '@/features/flow/FlowProvider';

function renderQuiz() {
  return render(
    <MemoryRouter initialEntries={['/quiz']}>
      <FlowProvider>
        <Routes>
          <Route path="/quiz" element={<QuizFlow />} />
          <Route path="/" element={<p>welcome screen</p>} />
          <Route path="/reveal" element={<p>report screen</p>} />
        </Routes>
      </FlowProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ sessionId: 'abc' }), { status: 200 })));
});

describe('QuizFlow', () => {
  it('starts with the name step and shows a progress bar', () => {
    renderQuiz();
    expect(screen.getByRole('heading', { name: /what should we call you/i })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /style check progress/i })).toBeInTheDocument();
  });

  it('moves to the first question and is skippable', async () => {
    const user = userEvent.setup();
    renderQuiz();
    await user.type(screen.getByRole('textbox', { name: /first name or nickname/i }), 'Ada');
    await user.click(screen.getByRole('button', { name: /^continue$/i }));

    expect(await screen.findByRole('heading', { name: QUESTIONS[0]!.prompt })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: QUESTIONS[0]!.prompt })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /skip this one/i }));
    await waitFor(() => expect(screen.getByRole('heading', { name: QUESTIONS[1]!.prompt })).toBeInTheDocument());
  });

  it('lets the participant stay anonymous', async () => {
    const user = userEvent.setup();
    renderQuiz();
    await user.click(screen.getByRole('button', { name: /keep me anonymous/i }));
    expect(await screen.findByRole('heading', { name: QUESTIONS[0]!.prompt })).toBeInTheDocument();
  });

  it('goes back to the welcome screen from the name step', async () => {
    const user = userEvent.setup();
    renderQuiz();
    await user.click(screen.getByRole('button', { name: /home/i }));
    expect(await screen.findByText('welcome screen')).toBeInTheDocument();
  });

  it('selects an option and advances automatically', async () => {
    const user = userEvent.setup();
    renderQuiz();
    await user.click(screen.getByRole('button', { name: /keep me anonymous/i }));
    const firstOption = await screen.findByRole('radio', { name: new RegExp(QUESTIONS[0]!.options[0]!.label, 'i') });
    await user.click(firstOption);
    await waitFor(() => expect(screen.getByRole('heading', { name: QUESTIONS[1]!.prompt })).toBeInTheDocument(), {
      timeout: 2000,
    });
    // The answered count updates in the header.
    expect(screen.getByText(/1 answered/i)).toBeInTheDocument();
  });

  it('shows the conversation card prompt after a choice that has one', async () => {
    const user = userEvent.setup();
    renderQuiz();
    await user.click(screen.getByRole('button', { name: /keep me anonymous/i }));
    await user.click(await screen.findByRole('radio', { name: new RegExp(QUESTIONS[0]!.options[0]!.label, 'i') }));
    await waitFor(() => expect(screen.getByRole('note')).toBeInTheDocument(), { timeout: 2000 });
    expect(screen.getByRole('note')).toHaveTextContent(/talk about it/i);
  });
});
