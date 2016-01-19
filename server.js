///////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Welcome to your first Cloud Script revision.
// The examples here provide a quick introduction to using Cloud Script and some
// ideas about how you might use it in your game.
//
// There are two approaches for invoking Cloud Script: calling handler functions directly
// from the game client using the "RunCloudScript" API, or triggering Photon Webhooks associated with
// room events. Both approaches are demonstrated in this file. You can use one or the other, or both.
//
// Feel free to use this as a starting point for your game server logic, or to replace it altogether.
// If you have any questions or need advice on where to begin,
// check out the resources at https://playfab.com/cloud-script or check our forums at
// https://support.playfab.com. For issues which are confidential (involving sensitive intellectual
// property, for example), please contact our Developer Success team directly at devrel@playfab.com.
//
// - The PlayFab Team
//
///////////////////////////////////////////////////////////////////////////////////////////////////////

handlers.checkIfFirstConnexion = function (args) {

    // Get internal data "GameStarted"
    var playerData = server.GetUserInternalData({
        PlayFabId: currentPlayerId,
        Keys: ["GameStarted"]
    });

    var gameStarted;
    try {
        gameStarted = playerData.Data["GameStarted"].Value;
    } catch (e) {
        gameStarted = false;
    }

    if (!gameStarted) {
        // If game not stated set it at started
        var updateUserDataResult = server.UpdateUserInternalData({
            PlayFabId: currentPlayerId,
            Data: {
                "GameStarted": true
           }
        });

        // Get the starting att values
        var titleData = server.GetTitleData({
            Keys: ["StartKey", "StartLive", "StartShield"]
        });

        var keys = titleData.Data["StartKey"];
        var lives = titleData.Data["StartLive"];
        var shield = titleData.Data["StartShield"];
        var itemIds = [];

        for (var i = 0; i < keys; ++i) {
            itemIds.push("att_key");
        }
        for (var i = 0; i < lives; ++i) {
            itemIds.push("att_life");
        }
        for (var i = 0; i < shield; ++i) {
            itemIds.push("att_shield");
        }

        server.GrantItemsToUser({
            PlayFabId: currentPlayerId,
            Annotation: "Items given at start",
            "ItemIds": itemIds
        });

        return { messageValue: "Game started" };
    }

    return { messageValue: "Game was already started" };
}

handlers.gameOver = function () {

}

handlers.sellItem = function (args) {

    var userInventory = server.GetUserInventory({
        PlayFabId: currentPlayerId
    });

    // Get the items from the user inventory
    for (var i = 0; i < userInventory.Inventory.length; ++i) {
        var item = userInventory.Inventory[i];
        if (item.ItemId == args.itemId) {

            var catalogItems = server.GetCatalogItems({
                CatalogVersion: "Alpha"
            });

            // Get the item in the catalog
            for (var j = 0; j < catalogItems.Catalog.length; ++j) {
                var catalogItem = catalogItems.Catalog[j];
                if (catalogItem.ItemId == args.itemId) {

                    var itemInstanceId = item.ItemInstanceId;
                    var sellValue = catalogItem.VirtualCurrencyPrices["$C"];
                    var modifyItem = handlers.modifyItemUses(itemInstanceId, -1);

                    // Credit user
                    var modifyCoins = server.AddUserVirtualCurrency({
                        PlayFabId: currentPlayerId,
                        VirtualCurrency: "$C",
                        Amount: sellValue
                    });

                    return {
                        messageValue: "Sell item: item instance id =  " + itemInstanceId + " value " + sellValue + " remaining " + modifyItem.RemainingUses,
                        remainingItemUses: modifyItem.RemainingUses,
                        newCoinCredit: modifyCoins.Balance
                    };
                }
            }
        }
    }

    return { messageValue: "Sell item: item not found" };
}

handlers.manageItemEffect = function (args) {

    var itemId = args.itemId;
    var itemInstanceId = args.itemInstanceId;

    var coinsIncr = 0;
    var shieldsIncr = 0;
    var keysIncr = 0;
    var livesIncr = 0;

    var itemIds = [];

    // Get attributs values
    var userIventory = server.GetUserInventory({
        PlayFabId: currentPlayerId,
    });

    var shields = handlers.getUserItems(userIventory, "att_shield");


    if (itemId == "gr_bird") {
        // Coins
        if (Math.random() > 0.1) {
            coinsIncr = Math.floor(Math.random() * 20);
        }

        // Shield
        shieldsIncr = -1;

        // Live
        if (shields == null) {
            livesIncr = -1;
        }

    } else if (itemId == "gr_man") {
        // Coins
        if (Math.random() > 0.5) {
            coinsIncr = Math.floor(Math.random() * 100);
        }

        // Shield
        shieldsIncr = -2;

        // Live
        livesIncr = -(Math.floor(Math.random() * 2) + 1);
        if (shields != null) {
            livesIncr /= 2;
        }

    } else if (itemId == "gr_chest") {
    } else if (itemId == "gr_coin") {
            coinsIncr = 100;
    } else if (itemId == "gr_boss") {
        // Coins
        if (Math.random() > 0.5) {
            coinsIncr = Math.floor(Math.random() * 1000);
        }

        // Shield
        shieldsIncr = -2;

        // Live
        livesIncr = -(Math.floor(Math.random() * 3) + 2);
        if (shields != null) {
            livesIncr /= 2;
        }

    } else if (itemId == "gr_livepotion") {
        // Live
        livesIncr = Math.floor(Math.random() * 5) + 1;

    } else if (itemId == "gr_key") {
        keysIncr = 1;

    } else if (itemId == "gr_shield") {
        shieldsIncr = 1;

    } else if (itemId == "gr_life") {
        livesIncr = 1;

    } else if (itemId == "gr_map") {
    }

    if (itemIds.length > 0) {
        server.GrantItemsToUser({
            CatalogVersion: "Alpha",
            PlayFabId: currentPlayerId,
            Annotation: "Item from grid",
            ItemIds: itemIds
        });
    }

    // Modify att
    handlers.addAttributs(coinsIncr, shieldsIncr, keysIncr, livesIncr);

    // Consume the item found on the grid
    handlers.modifyItemUses(itemInstanceId, -1);

    return { messageValue: "Manage Item Effect : consumeItem " + itemInstanceId };
}

handlers.resetAttributs = function() {

    // Get the starting att values
    var titleData = server.GetTitleData({
        Keys: ["StartKey", "StartLive", "StartShield"]
    });

    var startKeys = titleData.Data["StartKey"];
    var startLives = titleData.Data["StartLive"];
    var startShield = titleData.Data["StartShield"];

    // Get attributs values
    var userIventory = server.GetUserInventory({
        PlayFabId: currentPlayerId,
    });

    var coins = userIventory.VirtualCurrency["$C"];
    var keys = handlers.getUserItems(userIventory, "att_key");
    var shields = handlers.getUserItems(userIventory, "att_shield");
    var lives = handlers.getUserItems(userIventory, "att_life");

    var coinsIncr = coins - 100;
    var keysIncr = keys.RemainingUses - startKeys;
    var shieldsIncr = shields.RemainingUses - startShield;
    var livesIncr = lives.RemainingUses - startLives;

    handlers.addAttributs(-coinsIncr, -shieldsIncr, -keysIncr, -livesIncr);

    return { messageValue: "resetAttributs : coins "  + coinsIncr + " keys " + keysIncr + " shields " + shieldsIncr + " live " + livesIncr};
}

handlers.addAttributs = function(coinsAdd, shieldsAdd, keysAdd, livesAdd) {

    // Get attributs values
    var userIventory = server.GetUserInventory({
        PlayFabId: currentPlayerId,
    });

    var coins = userIventory.VirtualCurrency["$C"];
    var shields = handlers.getUserItems(userIventory, "att_shield");
    var keys = handlers.getUserItems(userIventory, "att_key");
    var lives = handlers.getUserItems(userIventory, "att_life");

    // Coins
    if (coinsAdd > 0) {
        server.AddUserVirtualCurrency({
            PlayFabId: currentPlayerId,
            VirtualCurrency: "$C",
            Amount: coinsAdd
        });
    } else if (coinsAdd < 0) {
        server.SubtractUserVirtualCurrency({
            PlayFabId: currentPlayerId,
            VirtualCurrency: "$C",
            Amount: -coinsAdd
        });
    }

    var itemIds = [];

    // Shield
    if (shields != null) {
        if (shields.RemainingUses + shieldsAdd < 0) {
            shieldsAdd = -shields.RemainingUses;
        }
        if (shieldsAdd != 0) {
            handlers.modifyItemUses(shields.ItemInstanceId, shieldsAdd);
        }
    } else {
        for (var i = 0; i < shieldsAdd; ++i) {
            itemIds.push("att_shield");
        }
    }

    // Key
    if (keys != null) {
        if (keys.RemainingUses + keysAdd < 0) {
            keysAdd = -keys.RemainingUses;
        }
        if (keysAdd != 0) {
            handlers.modifyItemUses(keys.ItemInstanceId, keysAdd);
        }
    } else {
        for (var i = 0; i < keysAdd; ++i) {
            itemIds.push("att_key");
        }
    }

    // Live
    if (lives != null) {
        if (lives.RemainingUses + livesAdd < 0) {
            livesAdd = -lives.RemainingUses;
        }
        if (livesAdd != 0) {
            handlers.modifyItemUses(lives.ItemInstanceId, livesAdd);
        }
    } else {
        for (var i = 0; i < livesAdd; ++i) {
            itemIds.push("att_life");
        }
    }

    if (itemIds.length > 0) {
        server.GrantItemsToUser({
            PlayFabId: currentPlayerId,
            "ItemIds": itemIds
        });
    }
}

handlers.modifyItemUses = function (itemInstanceId, count) {
    var modifyItem = server.ModifyItemUses({
        PlayFabId: currentPlayerId,
        ItemInstanceId: itemInstanceId,
        UsesToAdd: count
    });
    return modifyItem;
}

handlers.getUserItems = function (userIventory, itemId) {
    for (var i = 0; i < userIventory.Inventory.length; ++i) {
        var item = userIventory.Inventory[i];
        if (item.ItemId == itemId) {
            return item;
        }
    }
    return null;
}