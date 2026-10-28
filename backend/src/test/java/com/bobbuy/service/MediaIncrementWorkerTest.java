package com.bobbuy.service;
import org.junit.jupiter.api.Test;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class MediaIncrementWorkerTest {
 @Test void boundedCyclesRecoverAfterFailureAndStopAndRestart(){
  var transfer=mock(MediaTransferWorker.class);when(transfer.transferOne()).thenThrow(new IllegalStateException("synthetic")).thenReturn(true,false,false);
  var worker=new MediaIncrementWorker(transfer,60000,2);worker.start();worker.start();try{worker.runCycle();worker.runCycle();verify(transfer,times(3)).transferOne();}finally{worker.stop();}assertThat(worker.isRunning()).isFalse();worker.runCycle();verifyNoMoreInteractions(transfer);
  worker.start();try{worker.runCycle();verify(transfer,times(4)).transferOne();}finally{worker.stop();}
 }
 @Test void overlappingCyclesNeverDoubleClaim()throws Exception{
  var transfer=mock(MediaTransferWorker.class);var entered=new CountDownLatch(1);var release=new CountDownLatch(1);when(transfer.transferOne()).thenAnswer(call->{entered.countDown();release.await(5,TimeUnit.SECONDS);return false;});
  var worker=new MediaIncrementWorker(transfer,60000,1);worker.start();var pool=Executors.newSingleThreadExecutor();try{var first=pool.submit(worker::runCycle);assertThat(entered.await(5,TimeUnit.SECONDS)).isTrue();worker.runCycle();release.countDown();first.get(5,TimeUnit.SECONDS);verify(transfer,times(1)).transferOne();}finally{release.countDown();pool.shutdownNow();worker.stop();}
 }
 @Test void invalidResourceBoundsAreRejected(){var transfer=mock(MediaTransferWorker.class);assertThatThrownBy(()->new MediaIncrementWorker(transfer,0,1)).isInstanceOf(IllegalArgumentException.class);assertThatThrownBy(()->new MediaIncrementWorker(transfer,1000,101)).isInstanceOf(IllegalArgumentException.class);}
}
