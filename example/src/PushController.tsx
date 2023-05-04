import { Component } from "react";
import { PushNotificationIOS } from "react-native/Libraries/PushNotificationIOS/PushNotificationIOS";
import PushNotification from "react-native-push-notification";
import { XMTPPush, Client } from "xmtp-react-native-sdk";

export default class PushController extends Component {
  client: Client;
  constructor(props: any) {
    console.log("PROPS:", props);
    super(props);
    this.client = props as Client;
  }
  componentDidMount() {
    PushNotification.configure({
      // (optional) Called when Token is generated (iOS and Android)
      onRegister(token: any) {
        console.log("TOKEN:", token);
        XMTPPush.register("localhost:8080", token.token as string);
      },
      // (required) Called when a remote or local notification is opened or received
      onNotification(notification: any) {
        console.log("NOTIFICATION:", notification);
        console.log("PROPS:", this.props);
        console.log("CLIENT:", this.client);

        const encryptedMessage = notification.data.encryptedMessage;
        const topic = notification.data.topic;

        if (encryptedMessage == null || topic == null) {
          return;
        }
        const conversation = this.props.client.conversations
          .list()
          .find((c: { topic: string }) => c.topic === topic);
        if (conversation == null) {
          return;
        }

        const peerAddress = conversation.peerAddress;
        const decodedMessage = conversation.decodeMessage(encryptedMessage);

        const body = decodedMessage.body;
        const title = peerAddress;

        console.log("BODY:", body);
        console.log("TITLE:", title);

        // process the notification here
        // required on iOS only
        notification.finish(PushNotificationIOS?.FetchResult.NoData);
      },
      // Android only
      senderID: "609788839593",
      // iOS only
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },
      popInitialNotification: true,
      requestPermissions: true,
    });
  }
  render() {
    return null;
  }
}
