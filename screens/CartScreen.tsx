import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type CartItem = {
  id: string;
  product_id: string;
  quantity: number;
  products?: {
    name: string;
    price_cents: number;
    image_url?: string;
  } | { name: string; price_cents: number; image_url?: string }[];
  // Fallback fields in case the schema is denormalized
  name?: string;
  price_cents?: number;
  image_url?: string;
};

export default function CartScreen() {
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    fetchCartItems();

    // Subscribe to realtime changes on the cart_items table
    const cartChannel = supabase
      .channel('cart-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'cart_items',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Realtime Cart Change:', payload);
          fetchCartItems();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(cartChannel);
    };
  }, [user]);

  const fetchCartItems = async () => {
    if (!user) return;
    
    // Fetch cart items and join with products table to get title and price
    const { data, error } = await supabase
      .from('cart_items')
      .select(`
        id,
        quantity,
        product_id,
        products (
          name,
          price_cents,
          image_url
        )
      `)
      .eq('user_id', user.id)
      .order('id', { ascending: true });

    if (error) {
      console.error('Error fetching cart items:', error);
    } else {
      setCartItems((data as unknown as CartItem[]) || []);
    }
    setLoading(false);
  };

  const removeFromCart = async (productId: string) => {
    if (!user) return;

    // Optimistic UI update
    setCartItems(prev => prev.filter(item => item.product_id !== productId));

    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('product_id', productId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error removing item:', error);
      // Re-fetch on error to revert optimistic update
      fetchCartItems();
    }
  };

  const renderItem = ({ item }: { item: CartItem }) => {
    const productData = Array.isArray(item.products) ? item.products[0] : item.products;
    const name = productData?.name || item.name || 'Unknown Product';
    const priceCents = productData?.price_cents || item.price_cents || 0;
    const price = (priceCents / 100).toFixed(2);
    const imageUrl = productData?.image_url || item.image_url;

    return (
      <View style={styles.cartItem}>
        {imageUrl ? (
          <Image source={{ uri: `https://supashop-urban.netlify.app${imageUrl}` }} style={styles.itemImage} resizeMode="cover" />
        ) : (
          <View style={[styles.itemImage, styles.placeholderImage]} />
        )}
        <View style={styles.itemInfo}>
          <Text style={styles.itemTitle}>{name}</Text>
          <Text style={styles.itemPrice}>₦{price} x {item.quantity}</Text>
        </View>
        <TouchableOpacity 
          style={styles.deleteButton} 
          onPress={() => removeFromCart(item.product_id)}
        >
          <Text style={styles.deleteText}>Remove</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const totalAmount = cartItems.reduce((sum, item) => {
    const productData = Array.isArray(item.products) ? item.products[0] : item.products;
    const priceCents = productData?.price_cents || item.price_cents || 0;
    return sum + (priceCents * item.quantity);
  }, 0);
  const totalAmountFormatted = (totalAmount / 100).toFixed(2);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {cartItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Your cart is empty.</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={cartItems}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
          />
          <View style={styles.footer}>
            <Text style={styles.totalText}>Total: ₦{totalAmountFormatted}</Text>
            <TouchableOpacity style={styles.checkoutButton}>
              <Text style={styles.checkoutText}>Checkout</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centered: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    gap: 16,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: '#000000',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemImage: {
    width: 60,
    height: 60,
    backgroundColor: '#111111',
    borderRadius: 8,
    marginRight: 16,
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '800',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  deleteButton: {
    padding: 8,
  },
  deleteText: {
    color: '#ff4444',
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
  },
  footer: {
    padding: 24,
    backgroundColor: '#111111',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  checkoutButton: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 30,
  },
  checkoutText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
