package com.bobbuy.livecart;
import org.springframework.web.bind.annotation.*;import static com.bobbuy.livecart.LiveCartModels.*;
@RestController @RequestMapping("/api/merchant/live-carts")
public class MerchantLiveCartController {private final LiveCartService service;public MerchantLiveCartController(LiveCartService service){this.service=service;}
 @GetMapping public CartList list(@RequestParam(defaultValue="OPEN") String status,@RequestParam(defaultValue="0") long since){return service.merchantCarts(status.toUpperCase(),since);}
 @GetMapping("/{cartId}") public Cart get(@PathVariable long cartId){return service.merchantCart(cartId);}
 @PostMapping("/{cartId}/lines") public Cart add(@PathVariable long cartId,@RequestBody AddLine in){return service.merchantAdd(cartId,in);}
 @PatchMapping("/{cartId}/lines/{lineId}") public Cart change(@PathVariable long cartId,@PathVariable long lineId,@RequestBody ChangeLine in){return service.merchantChange(cartId,lineId,in,false);}
 @DeleteMapping("/{cartId}/lines/{lineId}") public Cart delete(@PathVariable long cartId,@PathVariable long lineId,@RequestParam long expectedVersion){return service.merchantChange(cartId,lineId,new ChangeLine(null,null,null,expectedVersion),true);}
 @PostMapping("/{cartId}/lines/{lineId}/ready") public Cart ready(@PathVariable long cartId,@PathVariable long lineId){return service.ready(cartId,lineId,true);}
 @DeleteMapping("/{cartId}/lines/{lineId}/ready") public Cart unready(@PathVariable long cartId,@PathVariable long lineId){return service.ready(cartId,lineId,false);}
 @PostMapping("/{cartId}/settlement-preview") public Preview preview(@PathVariable long cartId,@RequestBody SelectLines in){return service.preview(cartId,in.lineIds());}
 @PostMapping("/{cartId}/settlements") public Cart settle(@PathVariable long cartId,@RequestBody SelectLines in){return service.settle(cartId,in);}
 @PostMapping("/{cartId}/settlements/{sid}/reopen") public Cart reopen(@PathVariable long cartId,@PathVariable long sid,@RequestBody Reopen in){return service.reopen(cartId,sid,in.note());}
 @PostMapping("/{cartId}/lines/{lineId}/link") public Cart link(@PathVariable long cartId,@PathVariable long lineId,@RequestBody LinkRequest in){return service.merchantLink(cartId,lineId,in);}
 @DeleteMapping("/{cartId}/lines/{lineId}/link") public Cart unlink(@PathVariable long cartId,@PathVariable long lineId,@RequestParam long expectedVersion){return service.merchantUnlink(cartId,lineId,expectedVersion);}
}
