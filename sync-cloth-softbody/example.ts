// Basic, complete example of how to use the engine
import {
    actions,
    Empty,
    Frames,
    Logging,
    SyncConcept,
    Vars,
} from "./engine/mod.ts";

export class CounterConcept {
    public count = 0;
    increment(_: Empty) {
        this.count++;
        return {};
    }
    decrement(_: Empty) {
        this.count--;
        return {};
    }
    _getCount(_: Record<PropertyKey, never>): { count: number }[] {
        return [{ count: this.count }];
    }
}

export class ButtonConcept {
    clicked({ kind, by }: { kind: string; by: string }) {
        return { kind, by };
    }
}

export class NotificationConcept {
    notify({ message, to }: { message: string; to: string }) {
        console.log("Notification: ", message, " to:", to);
        return { message, to };
    }
}

// Create new Sync engine
const Sync = new SyncConcept();
Sync.logging = Logging.TRACE;

// Register concepts
const concepts = {
    Button: new ButtonConcept(),
    Counter: new CounterConcept(),
    Notification: new NotificationConcept(),
};

// All concepts must be instrumented to be reactive and used in a sync
const { Button, Counter, Notification } = Sync.instrument(concepts);

// Each sync is a function that returns a declarative synchronization
const ButtonIncrement = ({}: Vars) => ({
    when: actions(
        [Button.clicked, { kind: "increment_counter" }, {}],
    ),
    then: actions(
        [Counter.increment, {}],
    ),
});

// Each sync can declare the used variables by destructuring the input vars object
const NotifyWhenReachTen = ({ user, count }: Vars) => ({
    when: actions(
        [Button.clicked, { kind: "increment_counter", by: user }, {}],
        [Counter.increment, {}, {}],
    ),
    where: (frames: Frames): Frames =>
        frames
            .query(Counter._getCount, {}, { count })
            .filter(($) => $[count] > 10),
    then: actions(
        [Notification.notify, { message: "Reached 10", to: user }],
    ),
});

// Register syncs by a unique name
const syncs = { ButtonIncrement, NotifyWhenReachTen };
Sync.register(syncs);

// Clicking the button 10 times will eventually trigger the notification
for (let i = 0; i < 11; i++) {
    await Button.clicked({ kind: "increment_counter", by: "Xavier" });
}
