package com.bobbuy.livecart;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.web.bind.annotation.*;
@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(assignableTypes={CustomerCartController.class,MerchantLiveCartController.class})
public final class LiveCartExceptionHandler {
 @ExceptionHandler(LiveCartException.class) ResponseEntity<Map<String,String>> handle(LiveCartException e){return ResponseEntity.status(e.status()).body(Map.of("code",e.code()));}
}
