/**
 * Engine/MapEngine/Item.js
 *
 * Item dropped to the ground
 *
 * This file is part of ROBrowser, Ragnarok Online in the Web Browser (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

define(function( require )
{
	"use strict";


	/**
	 * Load dependencies
	 */
	var DB            = require('DB/DBManager');
	var Network       = require('Network/NetworkManager');
	var PACKET        = require('Network/PacketStructure');
	var ItemObject    = require('Renderer/ItemObject');
	var Altitude      = require('Renderer/Map/Altitude');
	var Session       = require('Engine/SessionStorage');
	var ChatBox       = require('UI/Components/ChatBox/ChatBox');
	var ItemObtain    = require('UI/Components/ItemObtain/ItemObtain');
	var Inventory     = require('UI/Components/Inventory/Inventory');
	var Equipment     = require('UI/Components/Equipment/Equipment');


	/**
	 * Spam an item on the map
	 *
	 * @param {object} pkt - PACKET.ZC.ITEM_ENTRY
	 */
	function Exist( pkt )
	{
		var x = pkt.xPos - 0.5 + pkt.subX / 12;
		var y = pkt.yPos - 0.5 + pkt.subY / 12;
		var z = Altitude.getCellHeight( x, y );

		ItemObject.add(
			pkt.ITAID,
			pkt.ITID,
			pkt.IsIdentified,
			pkt.count,
			x,
			y,
			z
		);
	}


	/**
	 * Spam a new item on the map
	 *
	 * @param {object} pkt - PACKET.ZC.ITEM_FALL_ENTRY
	 */
	function Create( pkt )
	{
		var x = pkt.xPos - 0.5 + pkt.subX / 12;
		var y = pkt.yPos - 0.5 + pkt.subY / 12;
		var z = Altitude.getCellHeight( x, y ) + 5.0;

		ItemObject.add(
			pkt.ITAID,
			pkt.ITID,
			pkt.IsIdentified,
			pkt.count,
			x,
			y,
			z
		);
	}


	/**
	 * Spam a new item on the map
	 *
	 * @param {object} pkt - PACKET.ZC.ITEM_DISAPPEAR
	 */
	function Remove( pkt )
	{
		ItemObject.remove( pkt.ITAID );
	}


	/**
	 * Answer when player pick the item
	 *
	 * @param {object} pkt - PACKET.ZC.ITEM_PICKUP_ACK3
	 */
	function PickAnswer( pkt )
	{
		// Fail
		if( pkt.result === 6 ) {
			ChatBox.addText( DB.msgstringtable[53], ChatBox.TYPE.ERROR );
			return;
		}

		ItemObtain.append();
		ItemObtain.set( pkt.ITID, pkt.IsIdentified, pkt.count );

		var it = DB.getItemInfo( pkt.ITID );
		ChatBox.addText(
			DB.msgstringtable[153].replace('%s', pkt.IsIdentified ? it.identifiedDisplayName : it.unidentifiedDisplayName ).replace('%d', pkt.count ),
			ChatBox.TYPE.BLUE
		);

		Inventory.addItem(pkt);
	}


	/**
	 * Generic function to add items to inventory
	 *
	 * @param {object} pkt - PACKET.ZC.EQUIPMENT_ITEMLIST
	 */
	function InventoryList( pkt )
	{
		Inventory.setItems( pkt.itemInfo || pkt.ItemInfo );
	}


	/**
	 * Remove item from inventory
	 *
	 * @param {object} pkt - PACKET.ZC.ITEM_THROW_ACK
	 */
	function InventoryRemoveItem( pkt )
	{
		Inventory.removeItem( pkt.Index, pkt.count );
	}


	/**
	 * Remove an item from equipment, add it to inventory
	 *
	 * @param {object} pkt - PACKET.ZC.REQ_TAKEOFF_EQUIP_ACK
	 */
	function ItemTakeOff( pkt )
	{
		if( pkt.result ) {
			var item = Equipment.unEquip( pkt.index, pkt.wearLocation );
			if (item) {
				item.WearState = 0;
	
				var it = DB.getItemInfo( item.ITID );
				ChatBox.addText(
					it.identifiedDisplayName + " " + DB.msgstringtable[171],
					ChatBox.TYPE.ERROR
				);
	
				Inventory.addItem(item);
			}

			if (pkt.wearLocation & Equipment.LOCATION.HEAD_TOP)    Session.Entity.accessory2 = 0;
			if (pkt.wearLocation & Equipment.LOCATION.HEAD_MID)    Session.Entity.accessory3 = 0;
			if (pkt.wearLocation & Equipment.LOCATION.HEAD_BOTTOM) Session.Entity.accessory  = 0;
			if (pkt.wearLocation & Equipment.LOCATION.WEAPON)      Session.Entity.weapon     = 0;
			if (pkt.wearLocation & Equipment.LOCATION.SHIELD)      Session.Entity.shield     = 0;
		}
	}


	/**
	 * Equip an item
	 *
	 * @param {object} pkt - PACKET.ZC.REQ_WEAR_EQUIP_ACK
	 */
	function ItemEquip( pkt )
	{
		if (pkt.result == 1) {
			var item = Inventory.removeItem( pkt.index, 1 );
			var it   = DB.getItemInfo( item.ITID );
			Equipment.equip( item, pkt.wearLocation );
			ChatBox.addText(
				it.identifiedDisplayName + " " + DB.msgstringtable[170],
				ChatBox.TYPE.BLUE
			);

			// Display
			if (pkt.wearLocation & Equipment.LOCATION.HEAD_TOP)    Session.Entity.accessory2 = pkt.viewid;
			if (pkt.wearLocation & Equipment.LOCATION.HEAD_MID)    Session.Entity.accessory3 = pkt.viewid;
			if (pkt.wearLocation & Equipment.LOCATION.HEAD_BOTTOM) Session.Entity.accessory  = pkt.viewid;
			if (pkt.wearLocation & Equipment.LOCATION.WEAPON)      Session.Entity.weapon     = pkt.viewid;
			if (pkt.wearLocation & Equipment.LOCATION.SHIELD)      Session.Entity.shield     = pkt.viewid;
		}

		// Fail to equip
		else {
			ChatBox.addText(
				DB.msgstringtable[372],
				ChatBox.TYPE.ERROR
			);
		}
	}


	/**
	 * Remove item from inventory
	 * @param {object} pkt - PACKET.ZC.DELETE_ITEM_FROM_BODY
	 */
	function ItemRemove( pkt )
	{
		Inventory.removeItem( pkt.Index, pkt.Count );
	}


	/**
	 * Initialize
	 */
	return function ItemEngine()
	{
		Network.hookPacket( PACKET.ZC.ITEM_ENTRY,            Exist );
		Network.hookPacket( PACKET.ZC.ITEM_FALL_ENTRY,       Create );
		Network.hookPacket( PACKET.ZC.ITEM_FALL_ENTRY2,      Create );
		Network.hookPacket( PACKET.ZC.ITEM_DISAPPEAR,        Remove );
		Network.hookPacket( PACKET.ZC.ITEM_PICKUP_ACK,       PickAnswer );
		Network.hookPacket( PACKET.ZC.ITEM_PICKUP_ACK2,      PickAnswer );
		Network.hookPacket( PACKET.ZC.ITEM_PICKUP_ACK3,      PickAnswer );
		Network.hookPacket( PACKET.ZC.ITEM_PICKUP_ACK5,      PickAnswer );
		Network.hookPacket( PACKET.ZC.ITEM_THROW_ACK,        InventoryRemoveItem );
		Network.hookPacket( PACKET.ZC.NORMAL_ITEMLIST,       InventoryList );
		Network.hookPacket( PACKET.ZC.NORMAL_ITEMLIST2,      InventoryList );
		Network.hookPacket( PACKET.ZC.NORMAL_ITEMLIST3,      InventoryList );
		Network.hookPacket( PACKET.ZC.NORMAL_ITEMLIST4,      InventoryList );
		Network.hookPacket( PACKET.ZC.EQUIPMENT_ITEMLIST,    InventoryList );
		Network.hookPacket( PACKET.ZC.EQUIPMENT_ITEMLIST2,   InventoryList );
		Network.hookPacket( PACKET.ZC.EQUIPMENT_ITEMLIST3,   InventoryList );
		Network.hookPacket( PACKET.ZC.EQUIPMENT_ITEMLIST4,   InventoryList );
		Network.hookPacket( PACKET.ZC.REQ_TAKEOFF_EQUIP_ACK, ItemTakeOff );
		Network.hookPacket( PACKET.ZC.REQ_TAKEOFF_EQUIP_ACK2,ItemTakeOff );
		Network.hookPacket( PACKET.ZC.ACK_TAKEOFF_EQUIP_V5,  ItemTakeOff );
		Network.hookPacket( PACKET.ZC.REQ_WEAR_EQUIP_ACK,    ItemEquip );
		Network.hookPacket( PACKET.ZC.REQ_WEAR_EQUIP_ACK2,   ItemEquip );
		Network.hookPacket( PACKET.ZC.ACK_WEAR_EQUIP_V5,     ItemEquip );
		Network.hookPacket( PACKET.ZC.DELETE_ITEM_FROM_BODY, ItemRemove );
	};
});