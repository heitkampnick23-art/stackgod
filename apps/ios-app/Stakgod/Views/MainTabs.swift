import SwiftUI

struct MainTabs: View {
    var body: some View {
        TabView {
            AppsView()
                .tabItem { Label("Apps", systemImage: "square.grid.2x2") }
            BuildView()
                .tabItem { Label("Build", systemImage: "wand.and.stars") }
            AccountView()
                .tabItem { Label("Account", systemImage: "person.crop.circle") }
        }
        .tint(Brand.flame)
    }
}
