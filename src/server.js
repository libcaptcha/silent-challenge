import { createChallengeManager } from './challenge.js';
import {
    createChallengeBundle,
} from './vm.js';

export function silentMiddleware(options = {}) {
    const manager = createChallengeManager(options);
    const vmbcPath = options.vmbcPath || null;

    function handleChallenge(_request, response) {
        const challenge = manager.issue();
        response.json(challenge);
    }

    function handleVmbc(request, response) {
        const { challengeId } = request.params;
        const token = manager.getVmToken(challengeId);
        if (!token || !vmbcPath) {
            return response
                .status(404)
                .json({ error: 'Not found' });
        }
        try {
            const bundle = createChallengeBundle(
                vmbcPath, token,
            );
            response
                .set('Content-Type', 'application/octet-stream')
                .send(bundle);
        } catch {
            response
                .status(500)
                .json({ error: 'Bundle failed' });
        }
    }

    function handleVerify(request, response) {
        const { challengeId } = request.params;
        const payload = request.body;

        if (!challengeId || !payload) {
            return response
                .status(400)
                .json({
                    error: 'Missing challenge or payload',
                });
        }

        const headers = extractHeaders(request);
        const result = manager.verify(
            challengeId, payload, headers,
        );

        if (result.error) {
            return response.status(400).json(result);
        }

        response.json(result);
    }

    function requireToken(request, response, next) {
        const header = request.headers.authorization;
        if (!header?.startsWith('Bearer ')) {
            return response
                .status(401)
                .json({ error: 'No token' });
        }

        const payload = manager.validateToken(
            header.slice(7),
        );
        if (!payload) {
            return response
                .status(401)
                .json({ error: 'Invalid token' });
        }

        request.silentPayload = payload;
        next();
    }

    function mountRoutes(router) {
        router.post('/challenge', handleChallenge);
        router.get(
            '/challenge/:challengeId/vmbc',
            handleVmbc,
        );
        router.post(
            '/challenge/:challengeId/verify',
            handleVerify,
        );
        return router;
    }

    return {
        handleChallenge,
        handleVmbc,
        handleVerify,
        requireToken,
        mountRoutes,
        manager,
    };
}

function extractHeaders(request) {
    return {
        'user-agent':
            request.headers['user-agent'] || '',
        'accept-language':
            request.headers['accept-language'] || '',
        'sec-ch-ua':
            request.headers['sec-ch-ua'] || '',
        'sec-ch-ua-mobile':
            request.headers['sec-ch-ua-mobile'] || '',
        'sec-ch-ua-platform':
            request.headers['sec-ch-ua-platform'] || '',
    };
}
