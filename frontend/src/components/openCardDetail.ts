import type {MouseEvent} from 'react';

/** Card copy/space shares the existing native, keyboard-accessible detail opener. */
export function openCardDetail(event:MouseEvent<HTMLElement>,open:(trigger:HTMLButtonElement)=>void){
 const target=event.target;
 if(event.defaultPrevented||event.button!==0||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||!(target instanceof Element))return;
 if(target.closest('a,button,input,select,textarea,label,summary,[role="button"],[role="link"],[contenteditable="true"],[data-card-action]'))return;
 if(window.getSelection()?.isCollapsed===false)return;
 const trigger=event.currentTarget.querySelector<HTMLButtonElement>('button.product-photo:not(:disabled)');
 if(!trigger)return;
 trigger.focus({preventScroll:true});
 open(trigger);
}
