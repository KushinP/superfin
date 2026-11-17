import Foundation

/// What one of SuperFin's hardware keys does in the player on an iPad or the
/// Mac. Space and the left and right arrows are upstream's
/// (PlayerKeyboardPolicy), which knows when a sheet or the scrubber owns them.
enum PlayerShortcutAction: Equatable {
	case volumeUp
	case volumeDown
	case toggleMute
	case close
}

/// SuperFin's keyboard shortcuts in the player, beside upstream's. Foundation
/// only, so the standalone test in `tests/native` can check the map without
/// UIKit.
enum PlayerKeyBindings {
	/// UIKeyCommand's special inputs, spelled out: these are the values of
	/// `UIKeyCommand.inputLeftArrow` and its siblings.
	static let leftArrow = "UIKeyInputLeftArrow"
	static let rightArrow = "UIKeyInputRightArrow"
	static let upArrow = "UIKeyInputUpArrow"
	static let downArrow = "UIKeyInputDownArrow"
	static let escape = "UIKeyInputEscape"

	/// One step of the system volume HUD, so a key press moves it like the
	/// hardware volume buttons do.
	static let volumeStep = 1.0 / 16.0

	struct Binding: Equatable {
		let input: String
		let action: PlayerShortcutAction
		/// Shown when ⌘ is held on an iPad and in the Mac's menu bar.
		let title: String
	}

	static let all: [Binding] = [
		Binding(input: upArrow, action: .volumeUp, title: "Volume Up"),
		Binding(input: downArrow, action: .volumeDown, title: "Volume Down"),
		Binding(input: "m", action: .toggleMute, title: "Mute"),
		Binding(input: escape, action: .close, title: "Close Player"),
	]

	static func action(for input: String) -> PlayerShortcutAction? {
		all.first { $0.input == input.lowercased() || $0.input == input }?.action
	}

	/// The volume after a step up or down, kept inside 0...1.
	static func stepped(volume: Double, up: Bool) -> Double {
		min(max(volume + (up ? volumeStep : -volumeStep), 0), 1)
	}
}
