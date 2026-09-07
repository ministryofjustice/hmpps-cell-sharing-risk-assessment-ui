// Local WireMock fallback for shared header JS to avoid ORB from protected remote assets.

"use strict";
( () => {
    var r = class {
        constructor(e) {
            this.menuItems = [];
            this.menuItems = ["user", "services", "search"].map(s => {
                let i = e.querySelector(`.cdps-header__item--${s}`)
                  , n = i == null ? void 0 : i.querySelector(".cdps-header__link")
                  , o = e.querySelector(`.cdps-header__menu--${s}`);
                if (i && n && o)
                    return new a(this,s,i,n,o)
            }
            ).filter(s => !!s);
            let t = e.querySelector(".cdps-header__item--caseload .cdps-header__link");
            t && this.setBackUrl(t)
        }
        static init() {
            let e = document.querySelector('[data-module="cdps-header"]');
            e && new this(e)
        }
        closeMenus(e) {
            this.menuItems.filter(t => t.name !== e).forEach(t => t.close())
        }
        setBackUrl(e) {
            try {
                let t = new URL(e.href);
                t.searchParams.set("backUrl", window.location.href),
                e.href = t.href
            } catch (t) {}
        }
    }
      , a = class {
        constructor(e, t, s, i, n) {
            this.header = e;
            this.name = t;
            this.$item = s;
            this.$button = i;
            this.$menu = n;
            this.closeTimer = null;
            s.classList.add("cdps-header__item--with-menu"),
            i.role = "button",
            i.ariaControlsElements = [n],
            i.ariaExpanded = "false",
            i.href = "#",
            i.addEventListener("click", o => {
                this.toggle(o)
            }
            ),
            t === "user" && this.initClosingMenu()
        }
        initClosingMenu() {
            let e = this.closeSoon.bind(this)
              , t = this.cancelCloseSoon.bind(this);
            this.$button.addEventListener("focus", t),
            this.$button.addEventListener("blur", e),
            this.$menu.querySelectorAll("a").forEach(s => {
                s.addEventListener("focus", t),
                s.addEventListener("blur", e)
            }
            ),
            this.$button.addEventListener("keydown", s => {
                this.closeOnEscape(s)
            }
            ),
            this.$menu.addEventListener("keydown", s => {
                this.closeOnEscape(s)
            }
            )
        }
        get isOpen() {
            return this.$button.ariaExpanded === "true"
        }
        toggle(e) {
            e.preventDefault(),
            this.header.closeMenus(this.name),
            this.isOpen ? this.close() : this.open()
        }
        open() {
            this.$item.classList.add("cdps-header__item--with-open-menu"),
            this.$button.ariaExpanded = "true",
            this.$menu.ariaHidden = "false",
            this.$menu.removeAttribute("hidden")
        }
        close() {
            this.$item.classList.remove("cdps-header__item--with-open-menu"),
            this.$button.ariaExpanded = "false",
            this.$menu.ariaHidden = "true",
            this.$menu.setAttribute("hidden", "hidden")
        }
        closeSoon() {
            this.closeTimer = setTimeout( () => {
                this.close()
            }
            , 100)
        }
        cancelCloseSoon() {
            this.closeTimer && (clearTimeout(this.closeTimer),
            this.closeTimer = null)
        }
        closeOnEscape(e) {
            e.key === "Escape" && (e.preventDefault(),
            this.close(),
            this.$button.focus())
        }
    }
    ;
    document.addEventListener("DOMContentLoaded", () => {
        r.init()
    }
    );
}
)();
