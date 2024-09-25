export class Router {
    constructor() {
        this.routes = new Map();
        this.middlewares = [];
        this.currentRoute = null;
        this.previousRoute = null;
        this.errorHandler = this.defaultErrorHandler;
    }

    setErrorHandler(handler) {
        this.errorHandler = handler;
    }

    defaultErrorHandler(error) {
        console.log('Error changing view: ', error);
        alert(`Une erreur est survenue lors du changement de page : ${error.message}`);
    }

    addRoute(path, viewPath, htmlPath) {
        this.routes.set(path, { path, viewPath, htmlPath });
    }

    use(middleware) {
        this.middlewares.push(middleware);
    }

    async navigate(path) {
        if (this.routes.has(path)) {
            this.previousRoute = this.currentRoute;
            this.previousPath = this.path;
            history.pushState(null, '', path);
            const success = await this.handleLocationChange();
            if (!success && this.previousRoute) {
                // Revenir à la route précédente en cas d'échec
                console.log('Loading view has failed. Redirecting to previous view.');
                // history.pushState(null, '', this.previousRoute.path);
                console.log(this.previousRoute);
                window.location.hash = this.previousPath;
                // await this.handleLocationChange(); 
            }
        } else {
            console.error(`Route not found: ${path}`);
        }
    }

    async handleLocationChange() {
        const path = window.location.hash.split('?').at(0) || '#';
        const route = this.routes.get(path);

        if (route) {
            for (const middleware of this.middlewares) {
                await new Promise(resolve => middleware(path, resolve));
            }

            this.currentRoute = route;
            return await this.notifyListeners(route);
        } else {
            console.error(`No route found for ${path}`);
            this.errorHandler(`No route found for ${path}`);
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
        // window.addEventListener('hashchange', () => this.handleLocationChange());
        this.handleLocationChange();
    }
}