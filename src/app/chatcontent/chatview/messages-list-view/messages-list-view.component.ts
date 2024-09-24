import {
  ChangeDetectorRef,
  Component,
  inject,
  Input,
  OnInit,
} from '@angular/core';
import { MessageComponent } from './message/message.component';
import { MessageDateComponent } from './message-date/message-date.component';
import { collection, Firestore, onSnapshot } from '@angular/fire/firestore';
import { Message } from '../../../shared/models/message.class';
import { MessageGreetingComponent } from './message-greeting/message-greeting.component';
import { CommonModule, Time } from '@angular/common';
import { Subscription } from 'rxjs';
import { SearchService } from '../../../utils/services/search.service';
import { Channel } from '../../../shared/models/channel.class';
import { Chat } from '../../../shared/models/chat.class';
import { NavigationService } from '../../../utils/services/navigation.service';
import { UsersService } from '../../../utils/services/user.service';

@Component({
  selector: 'app-messages-list-view',
  standalone: true,
  imports: [
    MessageComponent,
    MessageDateComponent,
    MessageGreetingComponent,
    CommonModule,
  ],
  templateUrl: './messages-list-view.component.html',
  styleUrl: './messages-list-view.component.scss',
})
export class MessagesListViewComponent implements OnInit {
  private firestore = inject(Firestore);
  public navigationService = inject(NavigationService);
  public userService = inject(UsersService);
  private unsubMessages: any = null;
  public messages: Message[] = [];
  public messagesDates: Date[] = [];
  public noMessagesAvailable = true;
  public messageEditorOpen = false;

  @Input() currentObject!: Channel | Chat;

  @Input()
  set messagesPath(value: string | undefined) {
    this.messages = [];
    this.messagesDates = [];
    this.subscribeMessages(value);
  }

  private messageScrollSubscription: Subscription | undefined;

  constructor(
    private _cdr: ChangeDetectorRef,
    private searchService: SearchService
  ) {}

  ngOnInit(): void {
    this.messageScrollSubscription =
      this.searchService.messageScrollRequested.subscribe(
        (message: Message) => {
          this.scrollToMessageInView(message);
        }
      );
  }

  private scrollToMessageInView(message: Message) {
    const maxAttempts = 5;
    let attempts = 0;

    const scrollToElement = () => {
      const messageElement = document.getElementById(message.id);
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        messageElement.classList.add('color-change');
        setTimeout(() => {
          messageElement.classList.remove('color-change');
        }, 1750);
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(scrollToElement, 500);
      }
    };

    setTimeout(scrollToElement, 100);
  }

  sortMessagesDate(messageCreationDate: Date) {
    this.messagesDates.push(messageCreationDate);
    this.messagesDates.sort(
      (a, b) => a.getMonth() - b.getMonth() || a.getDate() - b.getDate()
    );
    this.messagesDates = this.messagesDates.filter((date, index, array) => {
      return index === 0 || date.getDate() !== array[index - 1].getDate();
    });

    this.messages.sort((a, b) => {
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  private subscribeMessages(messagesPath: string | undefined) {
    if (this.unsubMessages) this.unsubMessages();
    if (messagesPath) {
      this.unsubMessages = onSnapshot(
        collection(this.firestore, messagesPath),
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              let newMessage = new Message(
                change.doc.data(),
                messagesPath,
                change.doc.id
              );
              this.messages.push(newMessage);
              this.sortMessagesDate(newMessage.createdAt);
            }
            if (change.type === 'modified') {
              const message = this.messages.find(
                (message) => message.id === change.doc.id
              );
              if (message) message.update(change.doc.data());
            }
            if (change.type === 'removed') {
              this.messages = this.messages.filter(
                (message) => message.id !== change.doc.data()['id']
              );
            }
          });
          this._cdr.detectChanges();
        }
      );
    }
  }

  ngOnDestroy(): void {
    if (this.unsubMessages) {
      this.unsubMessages();
    }
    if (this.messageScrollSubscription) {
      this.messageScrollSubscription.unsubscribe();
    }
  }
}
