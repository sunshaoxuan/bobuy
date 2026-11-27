package com.bobbuy.livecart;
import java.util.List;import org.springframework.security.core.Authentication;import org.springframework.web.bind.annotation.*;import static com.bobbuy.livecart.LiveCartModels.*;
@RestController @RequestMapping("/api/cart")
public class CustomerCartController {private final LiveCartService service;public CustomerCartController(LiveCartService service){this.service=service;}
 @GetMapping public List<Cart> get(Authentication a){return service.customerCarts(a);}
 @GetMapping("/{cartId}") public Cart get(@PathVariable long cartId,Authentication a){return service.customerCart(cartId,a);}
 @PostMapping("/lines") public Cart add(@RequestBody AddLine in,Authentication a){return service.addCustomer(in,a);}
 @PatchMapping("/{cartId}/lines/{lineId}") public Cart change(@PathVariable long cartId,@PathVariable long lineId,@RequestBody ChangeLine in,Authentication a){return service.customerChange(cartId,lineId,in,a,false);}
 @DeleteMapping("/{cartId}/lines/{lineId}") public Cart delete(@PathVariable long cartId,@PathVariable long lineId,@RequestParam long expectedVersion,Authentication a){return service.customerChange(cartId,lineId,new ChangeLine(null,null,null,expectedVersion),a,true);}
 @PatchMapping("/lines/{lineId}") public Cart changeCanonical(@PathVariable long lineId,@RequestBody ChangeLine in,Authentication a){return service.customerChangeByLine(lineId,in,a,false);}
 @DeleteMapping("/lines/{lineId}") public Cart deleteCanonical(@PathVariable long lineId,@RequestParam long expectedVersion,Authentication a){return service.customerChangeByLine(lineId,new ChangeLine(null,null,null,expectedVersion),a,true);}
}
