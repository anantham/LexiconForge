import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const modules = vi.hoisted(() => ({
  loaded: new Set<string>(),
}));

vi.mock('./MainApp', () => {
  modules.loaded.add('main');
  return { default: () => <h1>Novel library</h1> };
});
vi.mock('./components/gita/GitaIndexPage', () => {
  modules.loaded.add('gita');
  return { GitaIndexPage: () => <h1>Gita index</h1> };
});
vi.mock('./components/gita/GitaChapter2Page', () => ({ default: () => <h1>Gita chapter 2</h1> }));
vi.mock('./components/gita/GitaSthitaprajnaPage', () => ({ GitaSthitaprajnaPage: () => <h1>Gita passage</h1> }));
vi.mock('./components/malayalam/MalayalamLibraryPage', () => ({ MalayalamLibraryPage: () => <h1>Malayalam index</h1> }));
vi.mock('./components/malayalam/UrakamProtoPage', () => ({ UrakamProtoPage: () => <h1>Malayalam passage</h1> }));
vi.mock('./components/calvino/CalvinoReader', () => ({ CalvinoReader: ({ pathname }: { pathname: string }) => <h1>Calvino {pathname}</h1> }));
vi.mock('./components/liturgy/LiturgyApp', () => ({ LiturgyApp: ({ pathname }: { pathname: string }) => <h1>Liturgy {pathname}</h1> }));
vi.mock('./components/sutta-studio/SuttaStudioPipelineLoader', () => ({ SuttaStudioPipelineLoader: () => <h1>Pipeline</h1> }));
vi.mock('./components/sutta-studio/SuttaStudioCompareView', () => ({ SuttaStudioCompareView: () => <h1>Compare</h1> }));
vi.mock('./components/sutta-studio/SuttaStudioApp', () => ({ SuttaStudioApp: () => <h1>Live sutta</h1> }));
vi.mock('./components/bench/SuttaStudioBenchmarkView', () => {
  throw new Error('Benchmark chunk download failed');
});
vi.mock('./components/sutta-studio/SuttaStudioView', () => {
  modules.loaded.add('sutta-view');
  return { SuttaStudioView: ({ packet }: { packet: { uid: string } }) => <h1>Packet {packet.uid}</h1> };
});
vi.mock('./content/references/sutta/mn10.json', () => {
  modules.loaded.add('mn10');
  return { default: { uid: 'mn10' } };
});
vi.mock('./content/references/sutta/mn117.json', () => {
  modules.loaded.add('mn117');
  return { default: { uid: 'mn117' } };
});

const navigate = async (path: string) => {
  await act(async () => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
};

afterEach(cleanup);

describe('route loading', () => {
  it('opens a standalone reader without initializing the novel app or other datasets', async () => {
    window.history.replaceState(null, '', '/gita');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Gita index' })).toBeInTheDocument();
    expect([...modules.loaded]).toEqual(['gita']);

    await navigate('/');
    expect(await screen.findByRole('heading', { name: 'Novel library' })).toBeInTheDocument();
    expect([...modules.loaded]).toEqual(['gita', 'main']);
  });

  it.each([
    ['/sutta/pipeline', 'Pipeline'],
    ['/sutta/compare', 'Compare'],
    ['/sutta/sn1.1', 'Live sutta'],
    ['/sutta/constructor', 'Live sutta'],
    ['/sutta/fojin/example', 'Live sutta'],
    ['/liturgy/morning', 'Liturgy /liturgy/morning'],
    ['/calvino/chapter-1', 'Calvino /calvino/chapter-1'],
    ['/malayalam/', 'Malayalam index'],
    ['/malayalam/urakam-ammathiruvadi', 'Malayalam passage'],
    ['/gita/', 'Gita index'],
    ['/gita/chapter/2/', 'Gita chapter 2'],
    ['/gita/sthitaprajna', 'Gita passage'],
  ])('preserves the %s route and its props', async (path, heading) => {
    window.history.replaceState(null, '', path);
    render(<App />);
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it('preserves alias deep links and renders the selected packet across navigation', async () => {
    window.history.replaceState(null, '', '/sutta/demo?mode=read#word-1');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Packet mn10' })).toBeInTheDocument();
    expect(window.location.pathname + window.location.search + window.location.hash)
      .toBe('/sutta/mn10?mode=read#word-1');

    await navigate('/sutta/mn117');
    expect(await screen.findByText('Packet mn117')).toBeInTheDocument();
    expect(screen.queryByText('Packet mn10')).not.toBeInTheDocument();
    await navigate('/sutta/mn10');
    expect(await screen.findByText('Packet mn10')).toBeInTheDocument();
    expect(screen.queryByText('Packet mn117')).not.toBeInTheDocument();
  });

  it('shows the failed download and a recovery action instead of a blank route', async () => {
    window.history.replaceState(null, '', '/bench/sutta-studio');
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to open this page:');
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
    expect(console.error).toHaveBeenCalledWith('[App] Failed to download page:', expect.any(Error));
  });
});
