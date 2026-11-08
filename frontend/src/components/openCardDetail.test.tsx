import {fireEvent,render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {openCardDetail} from './openCardDetail';

function Card({open,action=()=>{}}:{open:(trigger:HTMLButtonElement)=>void;action?:()=>void}){
 return <article data-testid="card" onClick={event=>openCardDetail(event,open)}>
  <button type="button" className="product-photo" aria-label="Product details: Tea" onClick={event=>open(event.currentTarget)}><span data-testid="image">Tea image</span></button>
  <button type="button" onClick={event=>open(event.currentTarget)}>Tea</button><p>500 g</p>
  <button type="button" onClick={action}>Reserve Tea</button><button disabled>Unavailable</button>
  <div data-card-action><span>Manage product</span><button onClick={action}>Edit</button></div>
  <a href="#issue" onClick={event=>event.preventDefault()}>Issue</a><label>Choose<input type="checkbox"/></label>
 </article>;
}
it('opens card copy and empty space through the real named opener without scrolling its focus',()=>{
 const open=vi.fn();render(<Card open={open}/>);const photo=screen.getByRole('button',{name:'Product details: Tea'}),focus=vi.spyOn(photo,'focus');
 fireEvent.click(screen.getByText('500 g'));expect(open).toHaveBeenCalledTimes(1);expect(open).toHaveBeenCalledWith(photo);expect(photo).toHaveFocus();expect(focus).toHaveBeenCalledWith({preventScroll:true});
 open.mockClear();fireEvent.click(screen.getByTestId('card'));expect(open).toHaveBeenCalledTimes(1);expect(open).toHaveBeenCalledWith(photo);
});
it('keeps native Enter/Space and image/name clicks single and adds no nested button or duplicate card tab stop',async()=>{
 const open=vi.fn(),user=userEvent.setup();const view=render(<Card open={open}/>);const photo=screen.getByRole('button',{name:'Product details: Tea'});photo.focus();
 await user.keyboard('{Enter}');expect(open).toHaveBeenCalledTimes(1);await user.keyboard(' ');expect(open).toHaveBeenCalledTimes(2);
 fireEvent.click(screen.getByTestId('image'));expect(open).toHaveBeenCalledTimes(3);fireEvent.click(screen.getByRole('button',{name:'Tea'}));expect(open).toHaveBeenCalledTimes(4);
 expect(view.container.querySelector('button button')).toBeNull();expect(screen.getByTestId('card')).not.toHaveAttribute('role','button');expect(screen.getByTestId('card')).not.toHaveAttribute('tabindex');
});
it('does not turn reserve, disabled controls, management copy, links or form controls into a detail click',()=>{
 const open=vi.fn(),action=vi.fn();render(<Card open={open} action={action}/>);
 fireEvent.click(screen.getByRole('button',{name:'Reserve Tea'}));fireEvent.click(screen.getByRole('button',{name:'Unavailable'}));fireEvent.click(screen.getByText('Manage product'));fireEvent.click(screen.getByRole('button',{name:'Edit'}));fireEvent.click(screen.getByRole('link'));fireEvent.click(screen.getByLabelText('Choose'));
 expect(action).toHaveBeenCalledTimes(2);expect(open).not.toHaveBeenCalled();
});
it('keeps selecting text and modified/secondary clicks from unexpectedly opening a detail',()=>{
 const open=vi.fn();render(<Card open={open}/>);const copy=screen.getByText('500 g');
 fireEvent.click(copy,{ctrlKey:true});fireEvent.click(copy,{metaKey:true});fireEvent.click(copy,{shiftKey:true});fireEvent.click(copy,{altKey:true});fireEvent.click(copy,{button:1});expect(open).not.toHaveBeenCalled();
 const selection=vi.spyOn(window,'getSelection').mockReturnValue({isCollapsed:false} as Selection);fireEvent.click(copy);expect(open).not.toHaveBeenCalled();selection.mockRestore();
});
it('does nothing for a card without an enabled native product opener',()=>{
 const open=vi.fn();render(<article onClick={event=>openCardDetail(event,open)}><p>Service summary</p><button className="product-photo" disabled>Unavailable photo</button></article>);fireEvent.click(screen.getByText('Service summary'));expect(open).not.toHaveBeenCalled();
});
