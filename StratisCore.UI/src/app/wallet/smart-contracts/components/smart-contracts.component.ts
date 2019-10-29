import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, of, Subscription } from 'rxjs';
import { catchError, take } from 'rxjs/operators';
import { ClipboardService } from 'ngx-clipboard';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { SmartContractsServiceBase, ContractTransactionItem } from '../smart-contracts.service';
import { GlobalService } from '@shared/services/global.service';
import { TransactionComponent, Mode } from './modals/transaction/transaction.component';
import { ModalService } from '@shared/services/modal.service';
import { CurrentAccountService } from '@shared/services/current-account.service';
import { WalletService } from '@shared/services/wallet.service';

@Component({
  selector: 'app-smart-contracts',
  templateUrl: './smart-contracts.component.html',
  styleUrls: ['./smart-contracts.component.css']
})
export class SmartContractsComponent implements OnInit, OnDestroy {

  private walletName = '';
  private subscriptions: Subscription[] = [];
  balance: number;
  selectedAddress: string;
  history: ContractTransactionItem[];
  coinUnit: string;

  constructor(private globalService: GlobalService,
              private smartContractsService: SmartContractsServiceBase,
              private walletService: WalletService,
              private clipboardService: ClipboardService,
              private modalService: NgbModal,
              private genericModalService: ModalService,
              private currentAccountService: CurrentAccountService) {

    this.coinUnit = this.globalService.getCoinUnit();
    this.walletName = this.globalService.getWalletName();
    this.selectedAddress = this.currentAccountService.address;

    this.subscriptions.push(this.walletService.wallet()
      .subscribe(balance => this.balance = balance.amountConfirmed));

    this.smartContractsService.GetHistory(this.walletName, this.selectedAddress)
      .pipe(catchError(error => {
          this.showApiError('Error retrieving transactions. ' + error);
          return of([]);
        }),
        take(1)
      )
      .subscribe(history => this.history = history);
  }

  ngOnInit() {
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  showApiError(error: string) {
    this.genericModalService.openModal('Error', error);
  }

  clipboardAddressClicked() {
    if (this.selectedAddress && this.clipboardService.copyFromContent(this.selectedAddress)) {
      console.log(`Copied ${this.selectedAddress} to clipboard`);
    }
  }

  callTransactionClicked() {
    this.showModal(Mode.Call);
  }

  createNewTransactionClicked() {
    this.showModal(Mode.Create);
  }

  showModal(mode: Mode) {
    const modal = this.modalService.open(TransactionComponent, {backdrop: 'static', keyboard: false});
    const transactionComponent = modal.componentInstance as TransactionComponent;
    transactionComponent.mode = mode;
    transactionComponent.selectedSenderAddress = this.selectedAddress;
    transactionComponent.balance = this.balance;
    transactionComponent.coinUnit = this.coinUnit;
  }

  txHashClicked(contract: ContractTransactionItem) {
    console.log('txhash clicked');
    this.smartContractsService
      .GetReceipt(contract.hash)
      .toPromise()
      .then(result => {
          // tslint:disable-next-line:max-line-length
          this.genericModalService.openModal('Receipt', '<pre class=\'selectable\'>' + JSON.stringify(result, null, '    ') + '</pre>');
        },
        error => {
          this.showApiError('Error retrieving receipt. ' + error);
        });
  }
}
