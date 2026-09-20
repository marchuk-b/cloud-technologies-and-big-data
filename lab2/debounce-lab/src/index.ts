import { Debouncer } from "./debouncer";

function test(message: string) {
    console.log(message);
}

const testNumber: number = 3;

switch (testNumber) {
    case 1: {
        // Test 1: leading = false, trailing = true
        console.log("=== Test 1 ===");

        const debouncer1 = new Debouncer({
            delay: 1000,
            leading: false,
            trailing: true
        });

        const fn1 = debouncer1.debounce(test);

        fn1("Hello");
        fn1("World");
        fn1("!");

        // Expected after 1000ms:
        // !
        break;
    }

    case 2: {
        // Test 2: leading = true, trailing = false
        console.log("=== Test 2 ===");

        const debouncer2 = new Debouncer({
            delay: 1000,
            leading: true,
            trailing: false
        });

        const fn2 = debouncer2.debounce(test);

        fn2("A"); // immediately
        fn2("B"); // ignored
        fn2("C"); // ignored

        // After 1200ms, the debounce period has ended.
        setTimeout(() => {
            fn2("D"); // immediately
        }, 1200);

        // Still inside the first debounce period.
        fn2("E"); // ignored

        // Expected:
        // A
        // D

        break;
    }

    case 3: {
        // Test 3: leading = true, trailing = true
        console.log("=== Test 3 ===");

        const debouncer3 = new Debouncer({
            delay: 1000,
            leading: true,
            trailing: true
        });

        const fn3 = debouncer3.debounce(test);

        fn3("A"); // immediately
        fn3("B"); // suppressed
        fn3("C"); // suppressed

        // After 1200ms, a new debounce period starts.
        setTimeout(() => {
            fn3("D"); // immediately
        }, 1200);

        fn3("E"); // suppressed, but becomes trailing candidate

        // Expected:
        // A
        // E
        // D

        break;
    }

    default:
        console.log("Unknown test");
        break;
}