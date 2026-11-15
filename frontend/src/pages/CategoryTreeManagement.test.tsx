import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {I18nProvider} from '../i18n';
import CategoryTreeManagement from './CategoryTreeManagement';
vi.mock('antd',async()=>({...await vi.importActual<typeof import('antd')>('antd'),TreeSelect:(await import('../test/CategoryTreeSelectMock')).CategoryTreeSelectMock}));
const api = vi.hoisted(() => ({list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn()}));
vi.mock('../api', () => ({categoryTreeApi: api}));
const nodes = [
  {id: 'rec-cat-private', parentId: null, name: {'ja-JP': '食品'}, fullPath: ['rec-cat-private'], sortOrder: 0, productCount: 0, deleteBlocked: true},
  {id: 'private-leaf', parentId: 'rec-cat-private', name: {'ja-JP': '飲料'}, fullPath: ['rec-cat-private','private-leaf'], sortOrder: 0, productCount: 1, deleteBlocked: true},
  {id: 'empty-private', parentId: null, name: {'ja-JP': '日用品'}, fullPath: ['empty-private'], sortOrder: 1, productCount: 0, deleteBlocked: false}
];
beforeEach(() => {vi.clearAllMocks(); localStorage.setItem('bobbuy_locale','en-US'); api.list.mockResolvedValue(nodes); api.create.mockResolvedValue({}); api.update.mockResolvedValue({}); api.remove.mockResolvedValue(undefined);});
async function show() {render(<I18nProvider><CategoryTreeManagement/></I18nProvider>); await screen.findByRole('article',{name:'食品'});}

it('renders Japanese paths without internal keys and explains blocked deletion', async () => {
  await show();
  expect(screen.getByRole('article',{name:'食品 › 飲料'})).toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(/rec-cat-|private-leaf|system_key/);
  expect(within(screen.getByRole('article',{name:'食品'})).getByRole('button',{name:'Delete category'})).toBeDisabled();
  expect(screen.getAllByText(/Deletion is blocked/)).toHaveLength(2);
});
it('adds a root with Japanese name and optional blank translations', async () => {
  await show(); fireEvent.click(screen.getByRole('button',{name:'Add top-level category'}));
  const dialog=screen.getByRole('dialog'); expect(within(dialog).getByRole('button',{name:'Save'})).toBeDisabled();
  fireEvent.change(within(dialog).getByRole('textbox',{name:'Japanese name'}),{target:{value:'家具'}});
  fireEvent.click(within(dialog).getByRole('button',{name:'Save'}));
  await waitFor(()=>expect(api.create).toHaveBeenCalledWith({parentId:null,name:{'ja-JP':'家具'}}));
});
it('renames without changing parent and preserves input on failure', async () => {
  await show(); api.update.mockRejectedValueOnce(new Error('internal-debug-key'));
  fireEvent.click(within(screen.getByRole('article',{name:'食品 › 飲料'})).getByRole('button',{name:'Rename category'}));
  fireEvent.change(screen.getByRole('textbox',{name:'Japanese name'}),{target:{value:'飲み物'}});
  fireEvent.click(screen.getByRole('button',{name:'Save'}));
  expect(await screen.findByText(/Could not save/)).toBeInTheDocument();
  expect(screen.getByRole('textbox',{name:'Japanese name'})).toHaveValue('飲み物');
  expect(api.update).toHaveBeenCalledWith('private-leaf',{parentId:'rec-cat-private',name:{'ja-JP':'飲み物'}});
  expect(document.body.textContent).not.toContain('internal-debug-key');
});
it('reorders with a single atomic request and disables boundaries', async () => {
  await show(); const row=within(screen.getByRole('article',{name:'食品'}));
  expect(row.getByRole('button',{name:'Move up'})).toBeDisabled();
  fireEvent.click(row.getByRole('button',{name:'Move down'}));
  await waitFor(()=>expect(api.update).toHaveBeenCalledTimes(1));
  expect(api.update).toHaveBeenCalledWith('rec-cat-private',{parentId:null,sortOrder:1});
});
it('offers a separate move action and excludes self and descendants', async () => {
  await show(); fireEvent.click(within(screen.getByRole('article',{name:'食品'})).getByRole('button',{name:'Move category'}));
  const dialog=screen.getByRole('dialog'); expect(within(dialog).queryByRole('textbox',{name:'Japanese name'})).not.toBeInTheDocument();
  const parent=within(dialog).getByRole('combobox',{name:'Parent category'});
  expect(parent.textContent).toContain('日用品');
  expect(parent.textContent).not.toMatch(/食品|飲料/);
  fireEvent.change(parent,{target:{value:'empty-private'}});
  fireEvent.click(within(dialog).getByRole('button',{name:'Save'}));
  await waitFor(()=>expect(api.update).toHaveBeenCalledWith('rec-cat-private',{parentId:'empty-private'}));
});
it('requires confirmation before deleting an empty node', async () => {
  await show(); fireEvent.click(within(screen.getByRole('article',{name:'日用品'})).getByRole('button',{name:'Delete category'}));
  expect(api.remove).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Delete category'}));
  await waitFor(()=>expect(api.remove).toHaveBeenCalledWith('empty-private'));
});
