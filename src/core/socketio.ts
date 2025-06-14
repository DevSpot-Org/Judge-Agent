import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { cache } from './cache';
import { projectAnalysisQueue } from './queueJob';

const WEBSOCKET_CORS = {
    origin: `${process.env['NEXT_PUBLIC_PROTOCOL']}${process.env['NEXT_PUBLIC_BASE_SITE_URL']}`,
    methods: ['GET', 'POST'],
};

export class SocketService {
    private io: SocketIOServer;

    constructor(server: HttpServer) {
        this.io = new SocketIOServer(server, {
            cors: WEBSOCKET_CORS,
        });

        this.io.listen(3001);

        this.initializeEventListeners();
    }

    private initializeEventListeners() {
        this.io.on('connection', socket => {
            socket.on('join-room', (userId: string) => {
                socket.join(userId);

                console.log(`Socket ${socket.id} joined room ${userId}`);
            });

            socket.on('create-project', async data => {
                console.log("got event")
                await this.analyzeProjectAction(data);
            });

            socket.on('has-pending-analysis', async (data, callback) => {
                try {
                    const response = await this.userHasPendingAnalysis(data);
                    callback(response);
                } catch (error) {
                    console.error('Error in has-pending-analysis:', error);
                    callback({ error: 'Internal server error' });
                }
            });

            socket.on('disconnect', () => {
                console.log('Client disconnected:', socket.id);
            });
        });
    }

    // Emit events to clients
    public emitCreatedProject = (results: any, creatorId: string, isFinal: boolean) => {
        console.log('Emitting project_created event to room', creatorId);

        this.io.emit(`project_created`, { results, creatorId, isFinal });
    };

    private async analyzeProjectAction(data: any) {
        const requestId = crypto.randomUUID();
        const projectUrl = data?.project_url;
        const creatorId = data?.creator_id;

        const currentCount = await cache.get(creatorId);

        if (currentCount) {
            await cache.set(creatorId, parseInt(currentCount) + 1);
        } else {
            await cache.set(creatorId, 1);
        }

        await projectAnalysisQueue.add('analyze-project', {
            projectUrl,
            creatorId,
            requestId,
        });
    }

    private async userHasPendingAnalysis(data: any) {
        const creatorId = data?.creator_id;

        const hasPendingAnalysis = parseInt((await cache.get(creatorId)) ?? '0') > 0;

        return hasPendingAnalysis;
    }
}
