import java.util.*;
class Chstuff
{
public static void main(String args[])
{
 int i=0,n,k;
 String a,b="";
 Scanner s=new Scanner(System.in);
System.out.println("enter the message");
 a=s.next();
 n=a.length();
 if(n>8)
System.out.println("invalid");
 else
 {
System.out.println("at transmission medium");
for(i=0;i<n;i++)
{
if(a.charAt(i)=='*')
{
System.out.println(a.charAt(i));
b=b+a.charAt(i);
System.out.println(a.charAt(i));
b=b+a.charAt(i);
}
else
{
System.out.println(a.charAt(i));
b=b+a.charAt(i);
}
}
 }
System.out.println("at reciever side");
 k=b.length();
 for(i=0;i<k;i++)
 {
if(b.charAt(i)=='*')
{
System.out.println(b.charAt(i));
i++;
}
else
System.out.println(b.charAt(i));

 }
}
}