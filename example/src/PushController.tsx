import { Component } from "react";
import { PushNotificationIOS } from "react-native/Libraries/PushNotificationIOS/PushNotificationIOS";
import PushNotification from "react-native-push-notification";
import { XMTPPush } from "xmtp-react-native-sdk";

export default class PushController extends Component {
  componentDidMount() {
    PushNotification.configure({
      // (optional) Called when Token is generated (iOS and Android)
      onRegister(token: any) {
        console.log("TOKEN:", token);
        XMTPPush.register("10.0.2.2:8080", JSON.stringify(token));
      },
      // (required) Called when a remote or local notification is opened or received
      onNotification(notification: { finish: (arg0: any) => void; }) {
        console.log("NOTIFICATION:", notification);
        // process the notification here
        // required on iOS only
        notification.finish(PushNotificationIOS.FetchResult.NoData);
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
