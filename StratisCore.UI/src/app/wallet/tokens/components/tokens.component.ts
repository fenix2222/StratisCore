import { Component, OnDestroy, OnInit } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { GlobalService } from '@shared/services/global.service';
import { ModalService } from '@shared/services/modal.service';
import { ClipboardService } from 'ngx-clipboard';
import { BehaviorSubject, combineLatest, forkJoin, interval, Observable, of, ReplaySubject, Subject } from 'rxjs';
import { catchError, map, startWith, switchMap, takeUntil } from 'rxjs/operators';

import { Mode, TransactionComponent } from '../../smart-contracts/components/modals/transaction/transaction.component';
import { SmartContractsServiceBase } from '../../smart-contracts/smart-contracts.service';
import { Disposable } from '../models/disposable';
import { Mixin } from '../models/mixin';
import { SavedToken, Token } from '../models/token';
import { TokenBalanceRequest } from '../models/token-balance-request';
import { Log } from '../services/logger.service';
import { TokensService } from '../services/tokens.service';
import { AddTokenComponent } from './add-token/add-token.component';

@Component({
  selector: 'app-tokens',
  templateUrl: './tokens.component.html',
  styleUrls: ['./tokens.component.css']
})
@Mixin([Disposable])
export class TokensComponent implements OnInit, OnDestroy, Disposable {
  addressChanged$: Subject<string>;
  tokensRefreshRequested$ = new BehaviorSubject<boolean>(true);
  polling$: Observable<number>;
  addresses: string[];
  disposed$ = new ReplaySubject<boolean>();
  dispose: () => void;
  selectedAddress: string;
  history = [];
  walletName: string;
  tokens$: Observable<SavedToken[]>;
  availableTokens: Token[] = [];
  private pollingInterval = 5 * 1000; // polling milliseconds

  constructor(
    private tokenService: TokensService,
    private smartContractsService: SmartContractsServiceBase,
    private clipboardService: ClipboardService,
    private genericModalService: ModalService,
    private modalService: NgbModal,
    private globalService: GlobalService) {

    this.addressChanged$ = new Subject();
    this.walletName = this.globalService.getWalletName();
    this.tokens$ = this.getBalances();
    this.availableTokens = this.tokenService.GetAvailableTokens();
    this.availableTokens.push(new Token('Custom', 'custom'));

    this.smartContractsService
      .GetAddresses(this.walletName)
      .pipe(
        catchError(error => {
          Log.error(error);
          this.showApiError(`Error retrieving addressses. ${error}`);
          return of([]);
        }),
        takeUntil(this.disposed$)
      )
      .subscribe(addresses => {
        if (addresses && addresses.length > 0) {
          this.addressChanged$.next(addresses[0]);
          this.addresses = addresses;
          this.selectedAddress = addresses[0];
        }
      });

    this.addressChanged$
      .pipe(
        switchMap(address => this.smartContractsService.GetHistory(this.walletName, address)
          .pipe(catchError(error => {
            this.showApiError(`Error retrieving transactions. ${error}`);
            return of([]);
          })
          )
        ),
        takeUntil(this.disposed$)
      )
      .subscribe(history => this.history = history);


    this.addressChanged$
      .pipe(takeUntil(this.disposed$))
      .subscribe(address => this.selectedAddress = address);

    this.polling$ = interval(this.pollingInterval).pipe(startWith(0));
  }

  ngOnInit() {
  }

  ngOnDestroy() {
    this.dispose();
  }

  showApiError(error: string) {
    this.genericModalService.openModal('Error', error);
  }

  addressChanged(address: string) {
    this.addressChanged$.next(address);
  }

  clipboardAddressClicked() {
    if (this.selectedAddress && this.clipboardService.copyFromContent(this.selectedAddress)) {
      Log.info(`Copied ${this.selectedAddress} to clipboard`);
    }
  }

  addToken() {
    const modal = this.modalService.open(AddTokenComponent, { backdrop: 'static', keyboard: false });
    (<AddTokenComponent>modal.componentInstance).tokens = this.availableTokens;
    modal.result.then(value => {
      if (value === 'ok') {
        Log.info('Refresh token list');
        this.tokensRefreshRequested$.next(true);
      }
    });
  }

  issueToken() {
    const modal = this.modalService.open(TransactionComponent, { backdrop: 'static', keyboard: false });
    (<TransactionComponent>modal.componentInstance).mode = Mode.Create;
    (<TransactionComponent>modal.componentInstance).selectedSenderAddress = this.selectedAddress;
    // TODO: get current balance
    // (<TransactionComponent>modal.componentInstance).balance = this.balance;
    // (<TransactionComponent>modal.componentInstance).coinUnit = this.coinUnit;
  }

  get allTokens() {
    return [...this.tokenService.GetAvailableTokens(), ...this.tokenService.GetSavedTokens()];
  }

  getBalances(): Observable<SavedToken[]> {
    return combineLatest(this.addressChanged$, this.tokensRefreshRequested$, this.polling$)
      .pipe(
        switchMap(([address, _]) =>
          forkJoin(
            this.allTokens.map(token =>
              this.tokenService
                .GetTokenBalance(new TokenBalanceRequest(token.hash, address))
                .pipe(
                  catchError(error => {
                    Log.error(error);
                    Log.log(`Error getting token balance for token hash ${token.hash}`);
                    return of(0);
                  }),
                  map(balance => {
                    return new SavedToken(
                      token.ticker,
                      token.hash,
                      balance
                    );
                  })
                )
            )
          )
        ));
  }

  send(item: any) {
    // TODO: show send dialog
  }
}