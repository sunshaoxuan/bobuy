package com.bobbuy.livecart;
import java.util.List;import org.springframework.security.core.Authentication;import org.springframework.web.bind.annotation.*;import static com.bobbuy.livecart.LiveCartModels.*;
@RestController @RequestMapping("/api/cart")
public class CustomerCartController {private final LiveCartService service;private final CartAudioTranscriptionService audio;public CustomerCartController(LiveCartService service,CartAudioTranscriptionService audio){this.service=service;this.audio=audio;}
 @GetMapping public List<Cart> get(Authentication a){return service.customerCarts(a);}
 @GetMapping("/{cartId}") public Cart get(@PathVariable long cartId,Authentication a){return service.customerCart(cartId,a);}
 @PostMapping("/lines") public Cart add(@RequestBody AddLine in,Authentication a){return service.addCustomer(in,a);}
 @PatchMapping("/{cartId}/lines/{lineId}") public Cart change(@PathVariable long cartId,@PathVariable long lineId,@RequestBody ChangeLine in,Authentication a){return service.customerChange(cartId,lineId,in,a,false);}
 @DeleteMapping("/{cartId}/lines/{lineId}") public Cart delete(@PathVariable long cartId,@PathVariable long lineId,@RequestParam long expectedVersion,Authentication a){return service.customerChange(cartId,lineId,new ChangeLine(null,null,null,expectedVersion),a,true);}
 @PatchMapping("/lines/{lineId}") public Cart changeCanonical(@PathVariable long lineId,@RequestBody ChangeLine in,Authentication a){return service.customerChangeByLine(lineId,in,a,false);}
 @DeleteMapping("/lines/{lineId}") public Cart deleteCanonical(@PathVariable long lineId,@RequestParam long expectedVersion,Authentication a){return service.customerChangeByLine(lineId,new ChangeLine(null,null,null,expectedVersion),a,true);}
 @PostMapping("/text-requests") public TextBatch text(@RequestBody TextRequest in,Authentication a){return service.addTextRequests(in,a);}
 @GetMapping("/audio-transcription") public CartAudioTranscriptionService.Capability audioCapability(){return audio.capability();}
 @PostMapping(value="/audio-transcription",consumes="multipart/form-data") public CartAudioTranscriptionService.Result transcribe(@RequestPart("audio") org.springframework.web.multipart.MultipartFile file,@RequestParam double durationSeconds,@RequestParam(required=false) String locale,Authentication a){return audio.transcribe(a.getName(),file,durationSeconds,locale);}
 @PostMapping("/{cartId}/lines/{lineId}/link") public Cart link(@PathVariable long cartId,@PathVariable long lineId,@RequestBody LinkRequest in,Authentication a){return service.customerLink(cartId,lineId,in,a);}
 @DeleteMapping("/{cartId}/lines/{lineId}/link") public Cart unlink(@PathVariable long cartId,@PathVariable long lineId,@RequestParam long expectedVersion,Authentication a){return service.customerUnlink(cartId,lineId,expectedVersion,a);}
 @DeleteMapping("/text-requests/{batchId}") public Cart undo(@PathVariable java.util.UUID batchId,@RequestParam long expectedVersion,Authentication a){return service.undoBatch(batchId,expectedVersion,a);}
}
