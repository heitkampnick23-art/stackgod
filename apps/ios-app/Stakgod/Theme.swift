// Brand colors — match stakgod.com.

import SwiftUI

enum Brand {
    static let flame = Color(red: 1.0, green: 91.0/255, blue: 31.0/255)        // #ff5b1f
    static let gold  = Color(red: 212.0/255, green: 175.0/255, blue: 55.0/255) // #d4af37
    static let ink   = Color(red: 10.0/255, green: 10.0/255, blue: 15.0/255)   // #0a0a0f
    static let card  = Color.white.opacity(0.04)
    static let line  = Color.white.opacity(0.10)
    static let muted = Color.white.opacity(0.55)
}

extension Color {
    static let stakgodFlame = Brand.flame
    static let stakgodGold  = Brand.gold
    static let stakgodInk   = Brand.ink
}
