import java.io.*;
import java.util.*;
class Framesort
{
public static void main(String args[])
 {
 Scanner s=new Scanner(System.in);
System.out.println("enter the number of frames:");
int n=s.nextInt();
int seq[]=new int[n];
 String msg[]=new String[n];
for(int i=0;i<n;i++)
 {
System.out.println("enter the sequence no.of frame"+(i+1)+":");
seq[i]=s.nextInt();
s.nextLine();
System.out.println("enter the msg in frmae"+(i+1)+":");
msg[i]=s.nextLine();
 }
for(int i=0;i<n;i++)
 {
for(int j=0;j<n;j++)
 {
if(seq[j]>seq[i])
 {
int temp=seq[i];
seq[i]=seq[j];
seq[j]=temp;
 String tem=msg[i];
msg[i]=msg[j];
msg[j]=tem;
 }
 }
 }
for(int i=0;i<n;i++)
 {
System.out.println("frame sequence no ->"+seq[i]);
System.out.println("frame message ->"+msg[i]);
 }
 }
}

