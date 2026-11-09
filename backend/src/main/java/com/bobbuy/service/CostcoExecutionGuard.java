package com.bobbuy.service;

import com.bobbuy.model.CostcoOnboardingJob;
import com.bobbuy.model.Role;
import com.bobbuy.repository.SupplierRepository;
import com.bobbuy.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Every invocation uses a short, fresh transaction, outside all model/network calls. */
@Component
public class CostcoExecutionGuard implements CostcoNumberOnboardingService.ExecutionGuard {
    private final UserRepository users;private final SupplierRepository suppliers;private final String market;
    public CostcoExecutionGuard(UserRepository users,SupplierRepository suppliers,@Value("${bobbuy.ai.costco.market:JP}")String market){
        if(market==null||!market.matches("[A-Z]{2}"))throw new IllegalArgumentException("onboarding.market_config");this.users=users;this.suppliers=suppliers;this.market=market;
    }
    @Override @Transactional(readOnly=true) public void check(CostcoOnboardingJob job){checkScope(job.merchantId(),job.supplierId(),job.market());}
    @Transactional(readOnly=true) public void check(CostcoOfficialEvidenceFetcher.Query query){checkScope(query.merchantId(),query.supplierId(),query.market());}
    private void checkScope(long merchant,String supplier,String requestedMarket){
        if(!market.equals(requestedMarket)||users.findById(merchant).filter(u->u.isEnabled()&&u.getRoles().contains(Role.AGENT)).isEmpty()
                ||suppliers.findById(supplier).filter(s->Long.valueOf(merchant).equals(s.getMerchantId())).isEmpty())
            throw new CostcoNumberOnboardingService.NeedsInput("onboarding.scope_changed");
    }
}
