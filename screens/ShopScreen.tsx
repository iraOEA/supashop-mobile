import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type Product = {
  id: string;
  name: string;
  price_cents: number;
  image_url?: string;
};

export default function ShopScreen() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    setErrorMessage(null);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('id', { ascending: true });

    console.log('Fetched products:', data, 'Error:', error);

    if (error) {
      console.error('Error fetching products:', error);
      setErrorMessage(error.message);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  const addToCart = async (product: Product) => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to add items to cart.');
      return;
    }

    const { error } = await supabase
      .from('cart_items')
      .upsert(
        {
          user_id: user.id,
          product_id: product.id,
          quantity: 1,
        },
        { onConflict: 'user_id,product_id', ignoreDuplicates: true }
      );

    if (error) {
      console.error('Error adding to cart:', error);
      Alert.alert('Error', 'Could not add item to cart.');
    } else {
      Alert.alert('Added', `${product.name} added to your cart.`);
    }
  };

  const renderItem = ({ item }: { item: Product }) => (
    <View style={styles.productCard}>
      {item.image_url ? (
        <Image source={{ uri: `https://supashop-urban.netlify.app${item.image_url}` }} style={styles.productImage} resizeMode="cover" />
      ) : (
        <View style={[styles.productImage, styles.placeholderImage]} />
      )}
      <View style={styles.productInfo}>
        <View>
          <Text style={styles.productTitle}>{item.name}</Text>
          <Text style={styles.productPrice}>₦{(item.price_cents / 100).toFixed(2)}</Text>
        </View>
        <TouchableOpacity 
          style={styles.addButton} 
          onPress={() => addToCart(item)}
        >
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#ffffff" size="large" />
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>
          {errorMessage}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={products}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />
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
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
    fontWeight: 'bold',
  },
  listContent: {
    padding: 16,
    gap: 32,
  },
  productCard: {
    backgroundColor: '#000000',
    marginBottom: 16,
  },
  productImage: {
    width: '100%',
    height: 350,
    backgroundColor: '#111111',
    borderRadius: 12,
    marginBottom: 16,
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  addButton: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 30,
  },
  addButtonText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
