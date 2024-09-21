export class Router {
    constructor() {
        this.routes = new Map();
        this.middlewares = [];
        this.currentRoute = null;
        this.previousRoute = null;
    }

    addRoute(path, viewPath, htmlPath) {
        this.routes.set(path, { viewPath, htmlPath });
    }

    use(middleware) {
        this.middlewares.push(middleware);
    }

    async navigate(path) {
        console.log("Navigate is called for path: ", path);
        if (this.routes.has(path)) {
            this.previousRoute = this.currentRoute;
            history.pushState(null, '', path);
            const success = await this.handleLocationChange();
            if (!success && this.previousRoute) {
                // Revenir à la route précédente en cas d'échec
                console.log('Ca foire');
                history.pushState(null, '', this.previousRoute.path);
                await this.handleLocationChange();
            }
        } else {
            console.error(`Route not found: ${path}`);
        }
    }

    async handleLocationChange() {
        const path = window.location.hash || '#';
        // console.log(window.location.hash.slice(1), path);
        const route = this.routes.get(path);
        console.log(route);

        if (route) {
            for (const middleware of this.middlewares) {
                await new Promise(resolve => middleware(path, resolve));
            }
            console.log("done");

            this.currentRoute = route;
            return await this.notifyListeners(route);
        } else {
            console.error(`No route found for ${path}`);
            return false;
        }
    }

    notifyListeners(route) {
        if (this.changeListener) {
            return this.changeListener(route);
        }
        return true;
    }

    onRouteChange(listener) {
        this.changeListener = listener;
    }

    init() {
        console.log("init called");
        // window.addEventListener('hashchange', () => this.handleLocationChange());
        this.handleLocationChange();
    }
}