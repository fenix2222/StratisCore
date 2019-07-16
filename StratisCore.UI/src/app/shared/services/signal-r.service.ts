import { Injectable } from '@angular/core';
import * as signalR from '@aspnet/signalr';
import { Log } from 'src/app/wallet/tokens/services/logger.service';
import { ReplaySubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SignalRService {

  private hubConnection: signalR.HubConnection;

  public startConnection = (completed$: ReplaySubject<boolean>) => {
    this.hubConnection = new signalR.HubConnectionBuilder()
                            .withUrl('http://localhost:38224/events-hub')
                            .build();

    this.hubConnection
      .start()
      .then(() => {
        Log.info('Connection started');
        completed$.next(true);
        completed$.complete();
      })
      .catch(err => Log.info('Error while starting connection: ' + err));
  }

  public addFullNodeEventListener = () => {
    this.hubConnection.on('recieveEvent', (data) => {
      Log.info('New event from node', data);
    });
  }
}
