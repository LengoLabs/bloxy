import ClientBase, { ClientOptions } from "./ClientBase";
import initAPIs, { APIs } from "./apis";
import ClientUser from "../structures/ClientUser";
import RESTController from "../controllers/rest";
import { Group, PartialUser, User } from "../structures";
import * as ClientSocket from "./lib/ClientSocket/ClientSocket";
import ChatManager from "./lib/ChatManager/ChatManager";
import DataStoreManager from "./lib/DataStoreManager/DataStoreManager";


export default class Client extends ClientBase {
    public user: ClientUser | null;
    public apis: APIs;
    public rest: RESTController;
    public socket: ClientSocket.Socket;
    public dataStoreManager: DataStoreManager;
    public chat: ChatManager;

    constructor (options?: ClientOptions) {
        super(options);

        this.user = null;
        this.apis = initAPIs(this);
        this.rest = new RESTController(this, this.options.rest);
        this.socket = new ClientSocket.Socket(this);
        this.dataStoreManager = new DataStoreManager(this);
        this.chat = new ChatManager(this);

        this.init();
    }

    public isLoggedIn (): boolean {
        return this.user !== null;
    }

    init (): void {
        if (this.options.rest) {
            this.rest.setOptions(this.options.rest);
        }
    }

    public async login (cookie?: string): Promise<ClientUser> {
        this.log("info", {
            name: "Client.login",
            description: `Started login process..`
        });
        cookie = cookie || (this.options.credentials || {}).cookie || undefined;

        if (!cookie) {
            throw new Error("Attempted to log in without a cookie!");
        }
        this.options.credentials = {
            ...this.options.credentials,
            cookie
        };

        const createdCookie = this.rest.createCookie({
            key: ".ROBLOSECURITY",
            value: cookie,
            domain: "roblox.com",
            hostOnly: false,
            httpOnly: false
        });

        this.rest.addCookie(createdCookie);

        this.log("info", {
            name: "Client.login",
            description: `Added cookie to cookie jar, proceeding to fetching authenticated user information..`
        });

        const getAuthenticationData = await this.apis.usersAPI.getAuthenticatedUserInformation();
        this.user = new ClientUser({
            id: getAuthenticationData.id,
            name: getAuthenticationData.name
        }, this);
        this.emit("loggedIn");

        this.log("info", {
            name: "Client.login",
            description: `Successfully logged in as ${getAuthenticationData.name}`
        });

        return this.user;
    }

    getGroup (groupId: number): Promise<Group> {
        return this.apis.groupsAPI.getGroup({
            groupId
        })
            .then(data => {
                if (!data) {
                    throw new Error(`Group not found: ${groupId}`);
                } else {
                    return new Group(data, this);
                }
            });
    }

    getUser (userId: number | string): Promise<User> {
        if (typeof userId === "string") {
            userId = parseInt(userId);
        }

        // @ts-ignore
        return this.apis.usersAPI.getUserById({
             userId
        }).then(data => new PartialUser(data, this));

        /*
        [Bloxy uses broken endpoint]
        
        return this.apis.otherAPI.getUserProfileHeader({
            userId
        })
            .then(data => new User({
                id: data.ProfileUserId,
                name: data.ProfileUserName,
                displayName: data.ProfileDisplayName,
                canFollow: data.CanBeFollowed,
                canSeeInventory: data.CanSeeInventory,
                canTrade: data.CanTrade,
                incomingFriendRequest: data.IncomingFriendRequestPending,
                sentFriendRequest: data.FriendRequestPending,
                canMessage: data.CanMessage,
                isViewerBlocked: data.IsViewerBlocked,
                isVieweeBlocked: data.IsVieweeBlocked,
                followingsCount: data.FollowingsCount,
                followersCount: data.FollowersCount,
                userPlaceId: data.UserPlaceId,
                userStatusDate: data.UserStatusDate,
                userStatus: data.UserStatus,
                presenceType: data.UserPresenceType,
                friendsCount: data.FriendsCount,
                canFriend: data.MaySendFriendInvitation,
                areFriends: data.AreFriends,
                lastLocation: data.LastLocation,
                canSeeFavorites: data.CanSeeFavorites,
                headShotImage: {
                    final: data.HeadShotImage.Final,
                    endpointType: data.HeadShotImage.EndpointType,
                    retryUrl: data.HeadShotImage.RetryUrl,
                    url: data.HeadShotImage.Url,
                    userId: data.HeadShotImage.UserId
                },
                messagesDisabled: data.MessagesDisabled,
                previousUsernames: data.PreviousUserNames
            }, this)); */
    }

    getUserIdFromUsername (username: string): Promise<PartialUser> {
        return this.apis.usersAPI.getUsersByUsernames({
            usernames: [username],
            excludeBannedUsers: false
        })
            .then(response => {
                if (response.data && response.data[0]) {
                    return new PartialUser(response.data[0], this);
                } else {
                    throw new Error("Got invalid response from getUserIdFromUsername");
                }
            });
    }

    getUsernameFromUserId (userId: number | string): Promise<PartialUser> {
        if (typeof userId === "string") {
            userId = parseInt(userId);
        }

        return this.apis.generalApi.getUserById({
            userId
        })
            .then(data => new PartialUser(data, this));
    }

    getUsersByUserIds (userIds: number[] | string[], excludeBannedUsers = false): Promise<PartialUser[]> {
        if (typeof userIds[0] === "string") {
            userIds = (userIds as string[]).map(userId => parseInt(userId));
        }

        return this.apis.usersAPI.getUsersByIds({
            excludeBannedUsers,
            userIds: userIds as number[]
        })
            .then(response => response.data.map(userData => new PartialUser(userData, this)));
    }

    getUsersByUsernames (usernames: string[], excludeBannedUsers = false): Promise<PartialUser[]> {
        return this.apis.usersAPI.getUsersByUsernames({
            excludeBannedUsers,
            usernames
        })
            .then(response => response.data.map(userData => new PartialUser(userData, this)));
    }
}
