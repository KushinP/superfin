import Foundation

/// SuperFin's keys in the player on an iPad and the Mac, beside upstream's
/// PlayerKeyboardPolicy: each lands on its action, none is one the policy
/// owns, no key is bound twice, and volume steps stay in range.
@main
enum PlayerKeyBindingsTests {
    static func expect(_ condition: Bool, _ message: @autoclosure () -> String) {
        precondition(condition, message())
    }

    static func main() {
        // Space, left and right are upstream's PlayerKeyboardPolicy: bound here
        // too, each press would play and pause, or seek, twice.
        expect(PlayerKeyBindings.action(for: " ") == nil, "space is the keyboard policy's")
        expect(PlayerKeyBindings.action(for: PlayerKeyBindings.leftArrow) == nil, "left is the keyboard policy's")
        expect(PlayerKeyBindings.action(for: PlayerKeyBindings.rightArrow) == nil, "right is the keyboard policy's")
        expect(PlayerKeyBindings.action(for: PlayerKeyBindings.upArrow) == .volumeUp, "up raises the volume")
        expect(PlayerKeyBindings.action(for: PlayerKeyBindings.downArrow) == .volumeDown, "down lowers the volume")
        expect(PlayerKeyBindings.action(for: "m") == .toggleMute, "m mutes")
        expect(PlayerKeyBindings.action(for: "M") == .toggleMute, "M with caps lock still mutes")
        expect(PlayerKeyBindings.action(for: PlayerKeyBindings.escape) == .close, "escape closes the player")
        expect(PlayerKeyBindings.action(for: "x") == nil, "an unbound key does nothing")

        let inputs = PlayerKeyBindings.all.map(\.input)
        expect(Set(inputs).count == inputs.count, "no key is bound twice: \(inputs)")

        expect(PlayerKeyBindings.stepped(volume: 0.5, up: true) == 0.5 + 1.0 / 16.0, "a step up adds one HUD step")
        expect(PlayerKeyBindings.stepped(volume: 1, up: true) == 1, "volume stops at full")
        expect(PlayerKeyBindings.stepped(volume: 0.01, up: false) == 0, "volume stops at silent")

        print("PlayerKeyBindingsTests passed")
    }
}
